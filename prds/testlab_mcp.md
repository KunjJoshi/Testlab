# PRD: `testlab-mcp` — Testlab's MCP Server

## Overview

`testlab-mcp` is the MCP (Model Context Protocol) server that exposes Testlab's functionality as callable tools inside Claude Code. It is the component the `/testlab` slash command actually talks to: when Claude Code finishes analyzing a git diff and decides what test suite and test rows to create, it does so by calling tools on this server, not by hitting `testlab-backend`'s REST API directly.

## Problem Statement

Testlab's actual business logic — suites, test rows, sharing permissions — already lives in `testlab-backend` as a REST API. Claude Code cannot call an arbitrary REST API directly as part of a slash command; it can only call tools exposed through MCP. `testlab-mcp` exists solely to bridge that gap: a thin adapter layer, translating MCP tool calls into authenticated HTTP requests against the existing backend.

## Goals

- Expose every piece of Testlab functionality needed by the `/testlab` workflow — suite CRUD, test row CRUD (including bulk import), and sharing/access management — as individual, well-described MCP tools.
- Keep all real business logic and data access in `testlab-backend`. `testlab-mcp` holds no direct database connection and contains no ownership/permission logic of its own — it is a pass-through, not a second implementation.
- Support real, per-user authentication so that multiple people can connect to the same running `testlab-mcp` instance and have every tool call correctly attributed to their own identity, with no shared or hardcoded credentials.
- Run as a standard remote MCP server reachable over HTTP, connectable via `claude mcp add --transport http`, rather than a local stdio subprocess.

## Non-Goals

- Implementing OAuth token issuance. `testlab-mcp` is an OAuth **resource server** only — it validates bearer tokens and forwards them; `testlab-backend` is the authorization server that actually issues them. (Full detail in the separate CIMD/OAuth PRD.)
- Any caching, transformation, or business-rule enforcement beyond what's needed to shape a request/response between MCP's tool-call format and the backend's REST format.
- Session-based or stateful MCP features (sampling, elicitation, server-initiated notifications) — none of Testlab's tools require them, which is why the server runs in stateless HTTP mode.

## Architecture

```
Claude Code (MCP client)
   │  tool call, e.g. "create-test-suite"
   ▼
testlab-mcp (this component)
   │  validates bearer token, forwards as Authorization header
   ▼
testlab-backend (REST API + Postgres)
```

### Transport
Streamable HTTP, run in **stateless mode** (`server.WithStateLess(true)`). No `initialize`/session-ID handshake is required for any tool call. This was a deliberate choice made after discovering a real bug in Claude Code's own HTTP MCP client, which fails to propagate the `Mcp-Session-Id` header back on follow-up requests to session-aware servers built with the same underlying library (`mark3labs/mcp-go`) — stateless mode sidesteps the bug entirely and fits Testlab's tools naturally, since none of them need continuity between calls.

### Authentication
Every request to `/mcp` passes through bearer-token middleware that validates the JWT using the same secret and algorithm (`HS256`, explicitly pinned) as `testlab-backend`. A missing or invalid token returns `401` with a `WWW-Authenticate` header pointing at this server's own protected-resource metadata (`GET /.well-known/oauth-protected-resource`), so an MCP client can discover where to authenticate. The validated token is not just checked and discarded — it is carried through request context and re-attached as the `Authorization` header on every outbound call this server makes to `testlab-backend`, so the backend's own independent validation and ownership logic apply exactly as if the original caller had hit the REST API directly.

### Client layer
A single internal HTTP client (`internal/client`) wraps `testlab-backend`'s REST endpoints with four verbs — `Get`, `Post`, `Patch`, `Delete` — each accepting the request context so the caller's token flows through automatically. No tool talks to `net/http` directly; all 14 go through this one client.

## Tool Inventory

All 14 tools follow the same internal shape: a small handler struct holding a reference to the shared client, a constructor, and a `Handle(ctx, req)` method — no anonymous/inline functions anywhere in the tool layer.

### Suite management
| Tool | Backend endpoint | Purpose |
|---|---|---|
| `create-test-suite` | `POST /suites` | Create a new suite with a name and description |
| `get-suite-by-id` | `GET /suites/{id}` | Fetch one suite by ID |
| `list-all-suites` | `GET /suites` | List every suite owned by or shared with the caller |
| `update-suite` | `PATCH /suites/{id}` | Update a suite's name/description (only fields actually supplied are sent) |
| `delete-suite` | `DELETE /suites/{id}` | Delete a suite and its rows |

### Test row management
| Tool | Backend endpoint | Purpose |
|---|---|---|
| `create-test-row` | `POST /tests/write-test` | Add a single test row to a suite |
| `bulk-import-test-rows` | `POST /tests/import-bulk` | Import several test rows in one atomic call, via a JSON-array-as-string argument |
| `list-test-rows` | `GET /tests/{suite_id}` | List all rows belonging to a suite |
| `update-test-row` | `PATCH /tests/{row_id}` | Update row fields, including marking test status (`untested`/`in_progress`/`passed`/`failed`) |
| `delete-test-row` | `DELETE /tests/{row_id}` | Delete a single row |

### Sharing / access management
| Tool | Backend endpoint | Purpose |
|---|---|---|
| `provide-access` | `POST /access/provide` | Grant a user `read`/`write`/`admin` access to a suite |
| `list-users-with-access` | `GET /access/list-users/{suite_id}` | List everyone with access to a suite |
| `update-access` | `PATCH /access/update-access` | Change an existing collaborator's access scope |
| `remove-access` | `DELETE /access/remove-user` | Revoke a user's access entirely |

This set fully covers the original tool list scoped at project kickoff (`create-test-suite`, `register-test`, `delete-test`, `delete-test-suite`, `update-test`, `update-test-suite`, `mark-test-status`, `view-test-suite`, `view-test`) — status-marking was folded into `update-test-row`'s `status` field rather than kept as a separate tool, and "register" became `create-test-row`/`bulk-import-test-rows`.

## Design Decisions Worth Noting

- **`bulk-import-test-rows` takes its row array as a JSON-encoded string parameter (`test_rows_json`)**, rather than a native nested-array schema. This was a deliberate workaround, not an oversight — it avoided depending on unverified array-schema builder syntax in the MCP library, at the cost of the tool's description needing to spell out the expected shape explicitly for whatever's calling it.
- **`update-suite` and `update-test-row` only forward fields the caller actually supplied**, via a shared `buildPatchBody` helper reading off the raw argument map — this matters because the backend's `PATCH` handlers use `COALESCE` against the database, meaning an omitted field is correctly left untouched, while a field sent as an explicit empty string would overwrite existing data.
- **Every tool call is single-request, no retries or caching** — kept intentionally simple, since `testlab-backend` already owns transactional integrity (e.g. the bulk-import endpoint wraps its inserts in a single Postgres transaction).

## Testing Performed

- All 14 tools verified individually via a raw `tools/list` call over the stateless HTTP transport, confirming correct names, descriptions, and input schemas.
- Bearer middleware verified to reject missing/garbage tokens with 401, and to accept a real, independently-obtained JWT.
- Full connection proven inside an actual Claude Code session, including working around the confirmed Claude Code MCP client session-header bug via stateless mode.
- Manual round-trip testing of the suite/row/sharing lifecycle via natural-language requests to Claude Code, cross-checked directly against Postgres after each step.

## Known Issues / Cleanup Items

- `bulk-import-test-rows`'s tool description has a minor typo ("into asuite" → "into a suite").
- All tools currently report default MCP annotations (`readOnlyHint: false`, `destructiveHint: true`) regardless of whether they're actually read-only (e.g. `list-all-suites`, `get-suite-by-id`). Read-only tools should be updated to set `mcp.WithReadOnlyHintAnnotation(true)` for more accurate client-side confirmation prompts.

## Future Work

- Tools for reading across multiple linked repositories, if Testlab ever moves beyond single-local-checkout diffing (would depend on the GitHub App migration noted as future work in the CIMD/OAuth PRD).
- A `search-users` tool (surfacing users by username/GitHub handle, including avatar) to support discovering share targets without requiring a suite owner to already know a collaborator's numeric `user_id` — scoped as a future ticket at the time avatar support was added, not yet built.