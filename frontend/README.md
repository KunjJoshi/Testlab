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

- **Authentication.** The session is resolved by `GET /me`. How the browser
  receives its session is isolated in `src/auth/session.ts`.
- **Permissions** mirror the backend: `read` is view-only, `write` can edit tests
  and the suite, and `admin` (or the owner) can also share and delete.
- **User search** for sharing is mocked in `src/api/users.ts` until the backend
  search endpoint exists. Typing a numeric user ID always targets that exact user.
- **Bulk import** files must match the body of `POST /tests/import-bulk`; see the
  format reference in the import dialog. The file is parsed and validated in the
  browser, and only its contents are sent.
