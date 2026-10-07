# Testlab

**Keep a human in the loop when AI writes your code.**

## Why Testlab exists

Coding agents are fast. One prompt can produce hundreds of lines across a dozen files: new
routes, new UI, new validation rules and edge cases nobody spelled out. That code is often
too dense and too large to follow line by line, so people end up merging changes without
really knowing whether the features they asked for work.

Testlab closes that gap. Its `/testlab` command reads what changed on your branch (and,
optionally, the spec you wrote for it) and turns it into a **complete end-to-end manual
test suite**: one test per behaviour, each with execution steps, the expected HTTP status
and the expected output. You then work through the suite in the Testlab web app, marking
each test **Untested**, **In progress**, **Passed** or **Failed**, until you know what
actually works.

## Built for people, not to replace them

Testlab is created to **keep the human element in software development, not to automate it
away**. It doesn't run your tests for you, and it doesn't decide for you whether a feature
is done. The agent does the tedious part: reading the diff and writing down what should be
checked. A person does the part that matters: trying the feature, judging the result and
signing off on it.

## How it works

1. **Build** your feature on a branch, with or without a coding agent.
2. **Generate a suite.** In Claude Code, run `/testlab <base-branch> <your-branch> [prd-file]`.
   Testlab reads the diff, lists every user-facing behaviour that changed, and creates a new
   suite containing one test row per behaviour.
3. **Test it yourself.** Open the suite in the web app, follow each test's steps, and record
   the result. Tests can be edited inline, added by hand or bulk-imported from JSON.
4. **Share the results.** Give teammates or reviewers view-only, editor or admin access, so
   everyone can see what was checked and what's still failing before the branch merges.

Sign-in is via GitHub.

## What's in this repository

The repository contains three services plus a Claude Code skill:

| Directory | What it is | Default port |
| --- | --- | --- |
| [`testlab-backend/`](testlab-backend) | Go REST API, GitHub OAuth and OAuth 2.1 authorization server, Postgres | `8080` |
| [`testlab-mcp/`](testlab-mcp) | Go MCP server that exposes Testlab as tools for Claude Code | `8081` |
| [`frontend/`](frontend) | React + TypeScript web app | `5173` |
| [`.claude/commands/`](.claude/commands) | The `/testlab` Claude Code skill | — |

```
Browser ──► frontend (5173) ──/api──► testlab-backend (8080) ──► Postgres
Claude Code ──► testlab-mcp (8081) ─────────┘
```

Design documents live in [`prds/`](prds).

> **Never commit real `.env` files.** Each service ships a `.env.example` with placeholders.
> Copy it to `.env` and fill in your own values. `testlab-backend/.env` and
> `testlab-mcp/.env` are already git-ignored, and the frontend ignores `*.local` files.

---

## Prerequisites

- **Go** 1.26+ for the backend (`testlab-backend/go.mod`); the MCP server needs 1.25.5+.
- **Node.js** 20.19+ and npm for the frontend.
- **PostgreSQL**: a hosted Supabase project, or a local one via the
  [Supabase CLI](https://supabase.com/docs/guides/cli).
- A **GitHub account**, to register an OAuth App.
- **Claude Code**, only if you want to use the MCP server and the `/testlab` skill.

---

## 1. Testlab Backend

### 1.1 Create a GitHub OAuth App

1. On GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. **Homepage URL**: `http://localhost:5173`
3. **Authorization callback URL**: `http://localhost:8080/auth/github/callback`
   (this must match `GITHUB_REDIRECT_URL` below exactly).
4. Create the app, then **generate a client secret**. Keep the Client ID and the secret for
   the next step. Never commit or share the secret.

Testlab requests only the `read:user` and `user:email` scopes.

### 1.2 Set up the database

The schema lives in `testlab-backend/supabase/migrations/`. Apply it with the Supabase CLI:

```bash
cd testlab-backend

# Option A: hosted Supabase project
supabase link --project-ref <your-project-ref>
supabase db push

# Option B: local Postgres in Docker
supabase start          # prints a local DB URL, by default on port 54322
supabase db reset       # applies all migrations to the local database
```

### 1.3 Configure environment variables

```bash
cd testlab-backend
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Example / placeholder | What it's for |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | `postgresql://<user>:<password>@<host>:<port>/<db>` | Postgres connection string (Supabase → Project Settings → Database, or the URL `supabase start` prints). |
| `GITHUB_CLIENT_ID` | ✅ | `<your OAuth App client ID>` | From step 1.1. |
| `GITHUB_CLIENT_SECRET` | ✅ | `<your OAuth App client secret>` | From step 1.1. **Secret.** |
| `GITHUB_REDIRECT_URL` | ✅ | `http://localhost:8080/auth/github/callback` | Must equal the OAuth App's callback URL. |
| `JWT_SECRET` | ✅ | `<long random string>` | Signs session tokens (HS256). **Secret.** The MCP server must use the **same value**. |
| `ISSUER_URL` | | `http://localhost:8080` | Public URL of the backend, advertised in OAuth metadata. Default `http://localhost:8080`. |
| `FRONTEND_URL` | | `http://localhost:5173` | Where users are redirected after GitHub login. Default `http://localhost:5173`. |
| `ALLOWED_ORIGINS` | | `https://app.example.com,https://admin.example.com` | Comma-separated browser origins allowed by CORS. Defaults to `FRONTEND_URL`. Only needed when the frontend isn't served from the same origin as the API. `*` is never accepted. |
| `COOKIE_SECURE` | | `true` / `false` | `Secure` flag on the session cookie. Defaults to `true` when `FRONTEND_URL` is `https://`. |
| `PORT` | | `8080` | HTTP port. Default `8080`. |
| `DB_PASSWORD` | | | Not read by the code; it's a convenience for building `DATABASE_URL`. Can stay empty. |

Generate a strong `JWT_SECRET` with:

```bash
openssl rand -base64 48
```

### 1.4 Run

```bash
cd testlab-backend
go run ./cmd/server
# listening on :8080
```

Quick check: `curl -i http://localhost:8080/me` should return `401` (you aren't signed in).

**How sign-in works.** The browser goes to `/auth/github/login`. GitHub calls back to
`/auth/github/callback`, and the backend stores the session JWT in an **HttpOnly
`testlab_session` cookie**, then redirects to `FRONTEND_URL`. Browser writes must include an
`X-Requested-With` header, which the frontend sends automatically, as CSRF protection. API
and MCP clients use `Authorization: Bearer <token>` instead.

---

## 2. Testlab MCP Server

`testlab-mcp` is a thin MCP server over Streamable HTTP, running in stateless mode. It
checks each caller's bearer token and passes it on to the backend, so every tool call acts
as that user. It has no database access of its own. It exposes 14 tools covering suites,
test rows (including bulk import) and sharing.

### 2.1 Configure environment variables

```bash
cd testlab-mcp
cp .env.example .env
```

| Variable | Required | Example / placeholder | What it's for |
| --- | --- | --- | --- |
| `TESTLAB_BACKEND_URL` | ✅ | `http://localhost:8080` | Where to send tool calls. Also advertised to MCP clients as the OAuth authorization server. |
| `MCP_SELF_URL` | ✅ | `http://localhost:8081` | This server's public URL, used in `WWW-Authenticate` / protected-resource metadata. |
| `JWT_SECRET` | ✅ | `<same value as testlab-backend>` | Validates incoming tokens. **Must be identical to the backend's `JWT_SECRET`.** **Secret.** |
| `PORT` | | `8081` | HTTP port. Default `8081`. |

### 2.2 Run

Start the backend first, then:

```bash
cd testlab-mcp
go run ./cmd/server
# testlab-mcp listening on :8081
```

### 2.3 Connect Claude Code

```bash
claude mcp add --transport http testlab http://localhost:8081/mcp
```

The first time a Testlab tool is used, Claude Code finds out that the server needs
authentication and opens a browser to sign in with GitHub through the backend. After that,
every tool call is attributed to your account. Each person who connects gets their own token.

---

## 3. Frontend

React 19 + TypeScript (Vite), TanStack Query, React Router, Tailwind CSS and Radix UI. See
[`frontend/README.md`](frontend/README.md) for the code layout.

### 3.1 Configure environment variables (optional)

The defaults work for local development, so this step is optional.

```bash
cd frontend
cp .env.example .env.local     # *.local files are git-ignored
```

| Variable | Exposed to browser | Default | What it's for |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | yes | `/api` | Base path or URL the browser uses for the API. In dev, `/api` is proxied to the backend. |
| `TESTLAB_BACKEND_URL` | no (dev server only) | `http://localhost:8080` | Where the Vite dev proxy forwards `/api/*`. |

Anything prefixed `VITE_` is compiled into the browser bundle, so **never put secrets in
frontend env files**. The frontend needs none, because the session is an HttpOnly cookie
it never sees.

### 3.2 Run

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Make sure the backend's `FRONTEND_URL` points at this address (it does by default).

### 3.3 Checks and build

```bash
npm run eslint:fix   # ESLint with autofix (fails on anything it can't fix)
npm run prettier:fix # Prettier write
npm run tscheck      # TypeScript project check
npm run check        # typecheck + ESLint + Prettier check, without modifying files
npm run build        # production build into dist/
npm run preview      # serve the production build locally
```

Other scripts: `typecheck` (same as `tscheck`), `lint`, `lint:fix`, `format`, `format:check`.

### 3.4 Production notes

- Serve `dist/` and reverse-proxy `/api` to the backend **on the same origin** (recommended).
  Alternatively, set `VITE_API_BASE_URL` to the API's URL at build time and add the frontend's
  origin to the backend's `ALLOWED_ORIGINS`.
- The frontend and API must be on the same site (e.g. `app.example.com` + `api.example.com`)
  for the `SameSite=Lax` session cookie to be sent.
- Use HTTPS, and set the backend's `FRONTEND_URL`, `ISSUER_URL` and `GITHUB_REDIRECT_URL`
  (and the GitHub OAuth App's callback URL) to the production URLs.

---

## Tests and CI

### Running the tests

```bash
# MCP server: unit tests plus a real JSON-RPC round trip against a fake backend
cd testlab-mcp && go test -race ./...

# Backend unit tests (no database needed)
cd testlab-backend && go test -race ./...

# Backend database integration test: runs the full happy path through the router
docker run -d --rm --name testlab-test-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=testlab_test -p 55432:5432 postgres:17
cd testlab-backend
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/testlab_test?sslmode=disable" \
  go test -race ./...
docker stop testlab-test-pg
```

The integration test creates a uniquely named schema, applies every migration in
`testlab-backend/supabase/migrations` to it, and drops it afterwards. Without
`TEST_DATABASE_URL` it is skipped. **Only point it at a disposable database, never at your
real `DATABASE_URL`.** The tests set their own throwaway `JWT_SECRET`, so no real secrets
are needed.

### GitHub Actions

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request, on pushes
to `main`, and on demand. A **Detect changes** job checks which directories changed and
runs only the matching gates:

| Changed path | Gate | What runs |
| --- | --- | --- |
| `testlab-backend/**` | **Backend (Go)** | `go mod download`/`verify`, `go mod tidy` must be clean, `gofmt`, `go vet`, `go build`, `go test -race` (with a Postgres 17 service for the integration test) |
| `testlab-mcp/**` | **MCP server (Go)** | the same Go checks, plus `go test -race` |
| `frontend/**` | **Frontend** | `npm ci`, `npm run eslint:fix`, `npm run prettier:fix`, then fails if either fixer changed a file, then `npm run tscheck` and `npm run build` |

Changing the workflow file runs every gate, and so does running it manually. A final
**CI gate** job always runs and passes only if no gate failed or was cancelled; skipped
gates count as passing. Make **CI gate** the single required status check in branch
protection.

---

## Running everything locally

Use three terminals:

```bash
# 1. Backend
cd testlab-backend && go run ./cmd/server

# 2. MCP server (optional, for Claude Code)
cd testlab-mcp && go run ./cmd/server

# 3. Frontend
cd frontend && npm run dev
```

Open http://localhost:5173 and log in with GitHub.

---

## Claude Code skill: `/testlab`

The repository includes a Claude Code slash command at
[`.claude/commands/testlab.md`](.claude/commands/testlab.md). It reads the git diff between
two branches (and, optionally, a PRD), works out which user-facing behaviours changed, and
creates a new Testlab suite with one test row per behaviour. It uses the Testlab MCP
server's `create-test-suite` and `bulk-import-test-rows` tools.

**Requirements:** the backend and MCP server are running, and Claude Code is connected to
the MCP server (section 2.3).

**Usage** (run inside Claude Code from the repository root):

```text
/testlab <base-branch> <current-branch> [prd-file]
```

Examples:

```text
/testlab main my-feature
/testlab main UserSearch ./prds/userSearch.prd
```

- The **base branch comes first**, then the branch with your changes, then an optional PRD
  path that grounds the expected behaviour.
- Every run creates a **new** suite named `<current-branch> <timestamp>`; earlier suites are
  never reused.
- When it finishes, it reports the suite name, suite ID and how many tests it registered.
  The suite then appears under **Your suites** in the web app.

A second command, `/argtest <a> <b> <c>`, just echoes its arguments. Use it to check how
arguments are being parsed.
