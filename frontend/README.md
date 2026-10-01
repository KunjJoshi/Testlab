# Testlab frontend

React + TypeScript app for Testlab: organise end-to-end tests into suites, record
expected responses and execution steps, track each test's status, and share suites
with teammates.

## Stack

Vite · React 19 · TypeScript (strict) · React Router · TanStack Query · Tailwind CSS v4 ·
Radix UI primitives · lucide icons · sonner toasts.

## Getting started

```bash
cd frontend
cp .env.example .env.local   # optional; defaults work for local dev
npm install
npm run dev                  # http://localhost:5173
```

The dev server proxies `/api/*` to the backend (`TESTLAB_BACKEND_URL`, default
`http://localhost:8080`), so the browser only ever talks to its own origin.

## Scripts

| Script                 | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Start the dev server with hot reload                   |
| `npm run build`        | Type-check and build for production into `dist/`       |
| `npm run preview`      | Serve the production build locally                     |
| `npm run typecheck`    | TypeScript project check (`tsc -b`)                    |
| `npm run lint`         | ESLint (TypeScript, React hooks, jsx-a11y), 0 warnings |
| `npm run lint:fix`     | ESLint with autofix                                    |
| `npm run format`       | Prettier write                                         |
| `npm run format:check` | Prettier check                                         |
| `npm run check`        | `typecheck` + `lint` + `format:check` (use in CI)      |

## Layout

```
src/
  api/         TanStack Query hooks, one file per backend resource
  auth/        Session state (GET /me), login/logout, route guard
  components/  UI primitives (ui/) and feature components
  lib/         API client, types, formatting, permissions, bulk-import validation
  pages/       Login, Suites, Suite, Not found
  app/         Router
```

## Notes

- **Authentication.** GitHub OAuth via the backend, which keeps the session JWT
  in an HttpOnly `testlab_session` cookie — the app never sees the token. The
  session is resolved by `GET /me`; every request sends `credentials: 'include'`
  and an `X-Requested-With` header (the backend's CSRF guard). The backend's
  `FRONTEND_URL` must point at this app (default `http://localhost:5173`).
- **Production.** Serve `dist/` and reverse-proxy `/api` to the backend on the
  same origin (recommended), or set `VITE_API_BASE_URL` to the API's URL and add
  this app's origin to the backend's `ALLOWED_ORIGINS`. The frontend and API
  must be on the same site (e.g. `app.example.com` + `api.example.com`) for the
  `SameSite=Lax` cookie to be sent.
- **Permissions** mirror the backend: `read` is view-only, `write` can edit tests
  and the suite, and `admin` (or the owner) can also share and delete.
- **User search** for sharing is mocked in `src/api/users.ts` until the backend
  search endpoint exists. Typing a numeric user ID always targets that exact user.
- **Bulk import** files are a JSON array of test objects (see the import dialog
  for the fields). The file is parsed and validated in the browser; the app sends
  its contents to `POST /tests/import-bulk` with the open suite's ID.
