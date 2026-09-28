# PRD: CIMD-Based OAuth Authorization for Testlab

## Overview

Testlab's backend and MCP server originally authenticated requests with a single hardcoded bearer token pasted into an `.env` file — a stand-in used to prove that MCP tool calls could reach the backend correctly. This document describes the work replacing that placeholder with a real, multi-user OAuth 2.1 authorization flow, so that any user connecting via Claude Code is authenticated as themselves, with no manual token handling, and with proper per-user data isolation enforced end to end.

## Problem Statement

The original setup had three concrete gaps:

1. **No real user identity.** A single shared token meant every MCP tool call acted as one hardcoded user — there was no way for two different people to use Testlab against the same running MCP server and have their suites, test rows, and sharing permissions correctly separated.
2. **No standards-compliant client registration.** Claude Code, as an MCP client, needs a way to identify itself to an authorization server it has no prior relationship with. Traditional Dynamic Client Registration (DCR) would require Testlab to maintain a growing, stateful registry of every client that ever connects.
3. **No automatic sign-in.** The original GitHub login flow returned a raw JSON token directly to a browser — workable for manual testing, but not compatible with how MCP clients (including Claude Code) expect to discover, authenticate against, and cache credentials for a remote server automatically.

## Goals

- Every MCP tool call is authenticated as a real, individual GitHub-backed Testlab user.
- Claude Code can connect to the Testlab MCP server and complete an OAuth login automatically — no manually copied tokens, no custom scripts, in the steady state.
- Client identification uses **Client ID Metadata Documents (CIMD)** rather than Dynamic Client Registration, avoiding a stateful client registry.
- The authorization flow is a standards-compliant OAuth 2.1 implementation: authorization code grant, mandatory PKCE (S256), no client secrets (public clients only).
- Existing ownership and sharing logic (suite/row access scoped by `user_id`) requires zero changes — the new auth layer only changes how a `user_id` gets attached to a request, not what happens once it has one.

## Non-Goals

- Supporting Dynamic Client Registration as a fallback for clients that can't host a CIMD document. Given Claude Code is realistically the only client this project serves, DCR was explicitly deferred.
- Changing GitHub's role as the underlying identity provider. GitHub OAuth (via a classic OAuth App, `read:user user:email` scope only) remains the sole source of user identity; this work only changes what sits in front of it.
- Repo-level access scopes (GitHub App migration). Out of scope for this effort; noted as a separate future consideration if Testlab ever needs to read code across linked repositories.

## User-Facing Flow

1. A user runs `claude mcp add --transport http testlab <mcp-server-url>` once per machine.
2. On first use, Claude Code discovers that the server requires authentication and initiates an OAuth flow automatically, opening a browser.
3. The user logs in with GitHub (or is already logged in) and approves access.
4. Claude Code receives and caches an access token; from this point on, every tool call (`create-test-suite`, `mark-test-row`, `provide-access`, etc.) is attributed to that specific person.
5. A second person connecting to the same MCP server goes through the identical flow independently and is issued their own token, tied to their own `user_id` — their suites, rows, and sharing permissions remain fully separate from the first user's.

## Architecture Summary

### Component roles

| Component | Role |
|---|---|
| `testlab-backend` | OAuth 2.1 **authorization server**. Issues JWTs after a successful GitHub login. |
| `testlab-mcp` | OAuth 2.1 **resource server**. Validates incoming bearer tokens and forwards them to `testlab-backend`'s REST API on every tool call. |
| GitHub | Underlying **identity provider**. Unchanged from the original design — still a classic OAuth App, still only used to resolve "who is this person." |
| Claude Code | OAuth **client**. Presents a CIMD client identity; no pre-registration with Testlab required. |

### Why CIMD instead of DCR

A CIMD client's `client_id` is itself an HTTPS URL pointing to a small JSON document describing the client (name, allowed redirect URIs). The authorization server fetches and validates this document per request instead of maintaining a stored client registry. This avoids unbounded registry growth and matches the current MCP authorization spec's preference for CIMD over DCR as the default client-identification mechanism.

## Functional Requirements — `testlab-backend`

### 1. Discovery metadata
`GET /.well-known/oauth-authorization-server` publishes RFC 8414–style metadata: `issuer`, `authorization_endpoint`, `token_endpoint`, supported grant/response types, `code_challenge_methods_supported: ["S256"]`, `token_endpoint_auth_methods_supported: ["none"]`, and `client_id_metadata_document_supported: true`.

### 2. CIMD fetch and validation
Given a `client_id` presented at `/authorize`, the server:
- Rejects non-HTTPS `client_id` values outright.
- Fetches the document with a strict timeout and response-size cap, following no redirects.
- Blocks requests to loopback, private, link-local, and unspecified IP ranges (SSRF protection) by resolving the hostname before connecting.
- Confirms the document's own `client_id` field matches the URL it was fetched from (self-consistency check).
- Confirms the request's `redirect_uri` appears in the document's `redirect_uris` list, **with loopback port variance allowed per RFC 8252 §7.3** — the host, scheme, and path must match exactly, but the port may differ when the host is `127.0.0.1`, `::1`, or `localhost`, to accommodate native clients binding to an OS-assigned ephemeral port.
- Caches successfully validated documents for a bounded TTL.

Any validation failure renders a plain-text error directly, in-browser — the server never redirects to an unvalidated `redirect_uri`, which would otherwise be an open-redirect vector.

### 3. Authorization endpoint (`GET /authorize`)
Validates `response_type=code`, presence of `client_id`/`redirect_uri`/`code_challenge`, and that `code_challenge_method=S256` specifically (no plaintext PKCE). On success, stores a pending-authorization record (client ID, redirect URI, code challenge, original client state) keyed by a generated correlation ID, then redirects to GitHub using that correlation ID as GitHub's own `state` parameter.

### 4. GitHub callback (`GET /auth/github/callback`)
Dual-path, disambiguated by whether the incoming `state` matches a stored pending-authorization row:
- **CIMD path** (match found): completes the GitHub token exchange and user upsert, deletes the pending-authorization row, mints a single-use authorization code bound to `(user_id, client_id, redirect_uri, code_challenge)`, and redirects to the client's own `redirect_uri` with that code.
- **Legacy path** (no match): preserves the original direct-browser flow (cookie-based CSRF check, JSON token response), for manual/testing use.

Both paths share one underlying `exchangeAndUpsertUser` function — the GitHub exchange and `users` table upsert logic is not duplicated.

### 5. Token endpoint (`POST /token`)
Accepts `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, and `code_verifier`. Looks up and atomically deletes the matching authorization code (single-use), verifies `redirect_uri` and `client_id` match what was stored, verifies PKCE by hashing `code_verifier` (SHA-256, base64url, no padding) and comparing to the stored `code_challenge`, then issues a standard JWT access token via the existing `IssueToken` function. Returns a standard OAuth token response (`access_token`, `token_type`, `expires_in`).

## Functional Requirements — `testlab-mcp`

### 1. Transport
Switched from stdio to Streamable HTTP, running in **stateless mode** (`server.WithStateLess(true)`) — no `initialize`/session-ID handshake is required, since none of Testlab's tools need session continuity, sampling, or server-initiated notifications.

### 2. Protected resource metadata
`GET /.well-known/oauth-protected-resource` publishes `resource` (this server's own URL) and `authorization_servers` (pointing at `testlab-backend`), per RFC 9728, so Claude Code can discover where to authenticate.

### 3. Bearer validation middleware
Every request to `/mcp` is validated against the same JWT secret and algorithm (HS256, explicit `WithValidMethods` pin) used by `testlab-backend`. A missing or invalid token returns 401 with a `WWW-Authenticate` header pointing back at the protected-resource metadata endpoint.

### 4. Per-request token propagation
The validated caller's raw token is carried via request context through every one of the 14 tool handlers and the shared HTTP client, and forwarded as the `Authorization` header on every outbound call to `testlab-backend`. This replaced the original single hardcoded `client.Client.Token` field — the client and every tool's `Handle` method now accept `context.Context` as the mechanism for identifying which user is making the call.

## Data Model Changes

Two new tables in `testlab-backend`'s database, both short-lived by design:

```sql
CREATE TABLE pending_authorizations (
    correlation_id text PRIMARY KEY,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    code_challenge text NOT NULL,
    original_state text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE oauth_codes (
    code text PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    code_challenge text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);
```

No changes were required to `users`, `test_suites`, `test_rows`, or `shared_suites` — the entire ownership and sharing model was designed around `user_id` from the start, and this work only changes how a `user_id` is authenticated into a request, not how it's used afterward.

## Security Considerations

- **SSRF protection** on CIMD document fetches: HTTPS-only, no redirect-following, hostname resolved and checked against loopback/private/link-local ranges before connecting, response size capped.
- **Open-redirect protection**: any failure during client/redirect-URI validation is rendered as a direct in-browser error, never a redirect to an unvalidated `redirect_uri`.
- **PKCE is mandatory**, not optional — enforced by rejecting any `code_challenge_method` other than `S256` at `/authorize`.
- **Authorization codes are single-use**, enforced atomically via `DELETE ... RETURNING` rather than a separate read-then-delete step, closing a potential race window.
- **JWT algorithm is explicitly pinned** (`WithValidMethods(["HS256"])`) on both the issuing and validating sides, to avoid algorithm-confusion attacks even though only a symmetric secret is in use today.
- **Loopback redirect-URI matching** intentionally allows port variance, but only for `127.0.0.1`/`::1`/`localhost` hosts — this does not weaken validation for any real remote redirect target.

## Testing Performed

- Discovery metadata verified independently via direct `curl` against both `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.
- CIMD fetch/validation logic proven against a real hosted metadata document (a GitHub Gist) via a standalone harness before being wired into `/authorize`, including a deliberate negative test (mismatched `client_id` field correctly rejected).
- Full authorization code + PKCE + token exchange flow manually driven end-to-end via a bash script that performs the browser redirect, captures the loopback callback, and exchanges the resulting code — repeated until a real JWT was issued and independently decoded to confirm correct claims and expiry.
- Single-use enforcement of authorization codes confirmed by replaying an already-consumed code and observing rejection.
- `testlab-mcp`'s bearer middleware confirmed to reject missing/invalid tokens and accept a real token end-to-end through `tools/list`.
- Full connection proven inside an actual Claude Code session (`claude mcp add --transport http`), including working around a real, confirmed Claude Code client bug (session-header propagation on stateful `mark3labs/mcp-go` servers) by running the MCP server in stateless mode instead.

## Open Items / Future Work

- Migrate from a classic GitHub OAuth App to a GitHub App if/when Testlab needs to read across multiple linked repositories rather than relying solely on a user's local git diff.
- Consider whether `oauth_codes`/`pending_authorizations` need a periodic cleanup job for expired-but-undeleted rows, or whether the existing TTL-checked-at-read-time approach is sufficient at current scale.
- Revisit whether DCR support is ever warranted, should a second, non-CIMD-capable MCP client need to connect.