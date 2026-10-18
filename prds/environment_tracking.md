# PRD: Environment Tracking for Test Suites

## Overview

This feature gives every test suite an explicit environment — `Local`, `Dev`, `QA`, `Prod`, or any custom stage a user defines — and makes moving a suite between environments a deliberate, visible action rather than an implicit assumption. It directly supports Testlab's core handoff scenario: a developer tests locally, hands the suite to another developer for the Dev environment, then to QA, then on to user acceptance in Prod, with each stage owned by a different person.

## Problem Statement

Without environment tracking, a test suite has no record of *where* it's currently being tested, and no mechanism for signaling "this is ready for the next stage." A tester has no way to know whether a suite's current pass/fail state reflects testing done in the environment they're about to work in, or leftover results from a previous stage that no longer apply. Environment tracking closes that gap: promoting a suite to a new environment is an explicit action, and it's the trigger that resets test results so the next tester starts from a clean, accurate state.

## Goals

- Every test suite has a current environment, always.
- Promoting a suite to a higher-stage environment resets all of its test rows to `untested`, so results never carry over incorrectly between stages.
- Demoting a suite (moving backward, e.g. QA → Dev) does **not** reset results — a demotion isn't a new testing cycle in the same way a promotion is.
- Each user maintains their own ordered list of environments, seeded by default with `Local → Dev → QA → Prod`, extensible with custom stages (e.g. `Staging`, `UAT`) and reorderable.
- A collaborator with write access to someone else's suite can promote it into any environment in the *suite owner's* list — not their own — since the suite belongs to the owner's pipeline.

## Non-Goals

- Per-environment URL remapping (rewriting a test's execution steps to point at the right environment's actual service URL). Explicitly deferred to a future sprint.
- An audit trail of environment changes. The suite-edit audit trail (who promoted what, when) is a separate, already-scoped feature that lands after this one.
- Multi-tenant or organization-scoped environment lists. Environments belong to individual users today; a shared, team-wide environment list is a possible future direction, not built here.

## Data Model

```sql
CREATE TABLE environment (
    environment_id bigint generated always as identity primary key,
    slug text not null,
    rank integer not null,
    user_id bigint references users(user_id),
    created_at timestamptz not null default now(),
    UNIQUE (user_id, slug)
);

ALTER TABLE test_suites
    ADD COLUMN environment_id bigint NOT NULL REFERENCES environment(environment_id);
```

Every user gets four default rows (`local`/1, `dev`/2, `qa`/3, `prod`/4) seeded transactionally at account creation, alongside their `users` row. `rank` is the sole source of truth for pipeline order — comparisons use `rank`, never the raw `environment_id`, since a user's custom environments won't necessarily get sequential IDs in pipeline order.

## Backend API Surface

| Endpoint | Purpose |
|---|---|
| `POST /environments` | Create a new environment for the authenticated user |
| `GET /environments` | List the authenticated user's own environments, ordered by rank |
| `GET /environments/{user_id}` | List a *specific* user's environments — deliberately open to any authenticated caller, not relationship-gated, so a collaborator can see what environments a suite owner has available before promoting into one |
| `PATCH /environments/rename` | Rename a single environment's slug (rank cannot be changed this way) |
| `PATCH /environments/reorder` | Atomically reorder multiple environments' ranks in one transaction |
| `DELETE /environments/{id}` | Delete an environment; blocked at the database level if any suite currently references it |
| `PATCH /suites/promote-environment/{id}` | Change a suite's environment, validated against the *suite owner's* environment list, resetting all test rows to `untested` only when the move is a promotion (higher rank) |

## Design Decisions

- **Promotion requires only `write` scope, not `admin`.** The person testing in one environment is responsible for signaling "this is ready for the next stage," but not for deciding who picks it up next — that remains a separate, out-of-band handoff.
- **Rank, not environment_id, drives promotion logic.** `environment_id` is an autoincrementing identity with no guaranteed relationship to pipeline order once custom environments exist; `rank` is the explicit, user-controlled ordering.
- **The reorder endpoint is fully transactional.** Reordering several environments' ranks either all succeed or all roll back — a partial reorder would leave the rank sequence internally inconsistent, which the promotion logic silently depends on being correct.
- **A suite's `environment_id` is resolved against its owner, not the caller**, when a collaborator performs the promotion — otherwise a collaborator could point a suite at a row from their own, unrelated environment list.
- **`environment_id` on `test_suites` is `NOT NULL`**, enforced after a one-time backfill assigning every pre-existing suite its owner's lowest-rank environment. Every suite has a real environment from the moment it's created, with no "unset" state to account for anywhere downstream.

## MCP Tools

- **`list-environments`** — lists a given user's environments by `user_id`. Intentionally not restricted to the caller's own ID: the primary use case is a collaborator checking what environments are available on a suite they don't own, before calling `promote-suite`.
- **`promote-suite`** — promotes a suite to a new environment by ID, mirroring the REST endpoint's owner-scoped validation and reset behavior.

## Frontend

### Suite view: the environment badge

Every suite, when opened, shows an environment badge near the top of the page — a small, glanceable indicator of the suite's current stage. The badge pairs a colored status dot with the environment's slug text (e.g. a dot followed by "QA"), giving the badge both a color-coded and a text-labeled identity so it reads correctly at a glance and remains unambiguous for anyone who can't rely on color alone.

The badge is also the promotion control: clicking it opens a dropdown listing every environment in the suite's pipeline, in rank order, with the current one visibly marked. Selecting a different environment triggers the promotion — and because promoting to a *higher*-ranked environment silently resets every test row to `untested`, this should carry a confirmation step before committing (something like *"Promoting to QA will reset 12 test rows to Untested — continue?"*), so a tester never loses visible progress by accident. Demotions, which don't trigger a reset, don't need that same confirmation.

### Environment management: a dedicated page, reached from the user menu

The top navbar's user dropdown gains a new **Environment Management** entry, opening a page dedicated to managing one's own environment list. The page lists every environment the user owns, always sorted in ascending rank order, with two actions anchored at the top right: **Add New** and **Edit Environments**.

**Add New** creates a fresh environment, appended to the end of the pipeline (lowest priority, highest rank) by default, with its slug set at creation.

**Edit Environments** opens a modal for reordering: each environment appears as a row that can be dragged and dropped to a new position, with the full list re-ranking live as rows move. Saving the modal commits the new order in one call to the reorder endpoint, so a multi-row shuffle is either fully applied or fully rolled back — never left half-reordered.

The whole page is meant to be self-explanatory without external documentation — clear empty states, inline guidance on what promoting versus reordering actually does, and visible feedback (e.g., a brief confirmation) after every action, since this page is the one place a user directly shapes the pipeline that the suite badge's dropdown pulls from everywhere else in the app.

## Open Items

- Exact color mapping for the badge's status dot — a fixed palette by rank position (e.g., green for the lowest stage shading toward red for the highest), or a user-customizable color per environment? Not yet decided.
- Whether the "glow" treatment on the dot is a subtle persistent effect or reserved for signaling a recent change (e.g., glows briefly right after a promotion, then settles). Left to whoever implements the visual design.
- Whether deleting an environment that's still referenced by a suite currently returns a clean, user-facing error or lets a raw database constraint error surface — flagged as a known gap, deliberately deferred.