# Reminders API — SDET Take-Home Assessment

[![API Tests](https://github.com/RolanV/reminders-api-sdet-take-home/actions/workflows/api-tests.yml/badge.svg)](https://github.com/RolanV/reminders-api-sdet-take-home/actions/workflows/api-tests.yml)

Automated tests for the **Reminders API**: a Playwright API suite (functional
coverage), a set of regression tests that guard four confirmed API defects, and
a k6 load scenario. The API, the Playwright tests, and the k6 scenario all run
locally, with no accounts or external services required. GitHub Actions
separately runs the functional suite on pull requests and pushes to `main`.

- **Part A** — functional API tests (`GET /reminders`, `GET /reminders/{id}`, `POST /reminders`, `POST /reminders/{id}/complete`)
- **Part B** — regression tests for four confirmed bugs (intentionally failing until fixed)
- **Part C** — a k6 load scenario simulating a realistic user journey

The API contract is in [`API_REFERENCE.md`](./API_REFERENCE.md). Files under
`api/` are the system under test and were not modified.

## About this assessment

This repository is my submission for an SDET take-home assessment. The
assignment supplied a small Express **Reminders API** as the system under test,
its contract in `API_REFERENCE.md`, and a deliberately minimal test skeleton.
The task was to write functional API tests, hunt for defects and guard against
them, and run a load check.

**Supplied by the assessment author**, in the two commits preceding mine:

- The Express API under `api/`, and its contract in `API_REFERENCE.md`.
- The Playwright configuration (including the `webServer` hook that starts the
  API), the TypeScript configuration, and the k6 bundler and load profile.
- The `RemindersApi` endpoint wrapper and the `toHaveApiStatus` custom matcher.
- The `ReminderSchema` and `ReminderListSchema` Zod schemas.
- One example spec containing a single test, and one example k6 scenario
  containing a single request with a `TODO` for thresholds.

The framework foundations were therefore provided, not authored from scratch.
Files under `api/` were not modified.

**Added or modified in my submission:**

- Coverage specs for `GET /reminders/{id}`, `POST /reminders`, and
  `POST /reminders/{id}/complete`, including a create-then-fetch round trip and
  a completion test that re-fetches to confirm the change persisted.
- Nine further tests on `GET /reminders`, among them a controlled-data test
  that distinguishes genuine `dueDate` sorting from the default `createdAt`
  order — the seeded records have both fields in the same sequence, so seed
  data alone cannot tell the two apart.
- A regression suite tagged `@KnownBug` encoding four confirmed contract
  violations, each with a reproduction, each failing today by design.
- A test-data factory, plus `NotFoundErrorSchema` and `ValidationErrorSchema`
  for the 404 and 400 response bodies.
- A three-step k6 user journey with a custom `detail_fetch_duration` metric and
  four thresholds, replacing the single-request example.
- Separate npm scripts, so the functional suite stays green while the
  `@KnownBug` suite can be run on its own.
- The GitHub Actions workflow.
- A privacy fix to the supplied matcher: `API_REFERENCE.md` marks the `notes`
  field as sensitive, and the starter version of `toHaveApiStatus` printed up to
  400 characters of the response body in its failure message. I removed that
  excerpt, so failures report the endpoint and the expected and actual status
  without echoing response data.

**AI-assisted development:** The assignment encouraged the use of AI
development tools. I used Claude Code to assist with implementation and
documentation, while directing the scope and reviewing proposed changes. The
resulting tests were validated through local execution and GitHub Actions.

The fork history and comparison with the supplied starter code show which
components were inherited and which were added or modified for this submission.

## Verified results

The local runs below exercised the test and application code at commit
`817a0af`. The only difference between that commit and the current `main`
(`3087044`) is the addition of the CI workflow file, so the test and
application code exercised by those runs is the same code the repository holds
today. Documentation changes do not alter any test or application code.

**Local — 2026-10-27, macOS, Node v24.14.0, k6 v2.3.0**

| Suite | Command | Observed result |
|---|---|---|
| Functional | `npm test` | 24 passed |
| Smoke subset | `npm run test:smoke` | 3 passed |
| Known-bug regression | `npm run test:known-bugs` | 4 failed — by design, see [Bugs found](#bugs-found-part-b) |
| Load scenario | `npm run k6:smoke` | all four thresholds passed, see [Load test results](#load-test-results-part-c) |

**CI — GitHub Actions, Ubuntu 24.04, Node.js 24**

| Workflow | Trigger | Observed result |
|---|---|---|
| `API Tests` | push to `main` | 24 passed |

The four Part B failures are the deliverable of that part, not broken
automation. These are observed results from the runs described above; they are
not claims about production performance, reliability, or exhaustive coverage —
see [Known limitations](#known-limitations).

## Prerequisites

- **Node.js** — verified on Node 24, locally and in CI. The assignment
  documents Node 20 or newer as the minimum; that floor has not been tested
  here, and the project declares no `engines` field.
- **k6** (Part C only) — verified on k6 v2.3.0. Install with
  `brew install k6`, or see https://grafana.com/docs/k6/latest/set-up/install-k6/.

## Setup

```bash
npm ci        # reproducible install from package-lock.json
```

> The Playwright tests are API-only (they use Playwright's `request` context,
> not a browser), so a browser download is **not** required.

## Start the API

```bash
npm run api
```

The API listens on `http://localhost:3000` and resets its in-memory data every
time it starts.

## Running the tests

Playwright auto-starts the API (via `webServer`), so the commands below work on
their own; or run `npm run api` in a separate terminal.

### Part A — functional tests (expected to pass)

```bash
npm test              # functional suite (excludes the @KnownBug tag)
npm run test:smoke    # @Healthcheck smoke subset
```

Coverage highlights:

- The supplied API wrapper (`Reminders_API.ts`) and Zod schemas validate
  response **shape and types**, not just status codes; I added schemas for the
  404 and 400 error bodies.
- A test-data factory (`reminder.factory.ts`) builds valid and invalid payloads.
- Positive, negative, and edge cases across the list, get, and create
  endpoints; smoke tests are tagged `@Healthcheck`.
- A positive `POST /reminders/{id}/complete` test confirms the status
  transitions to `Done` and persists on a follow-up fetch.

### Part B — known-bug regression tests (expected to fail)

```bash
npm run test:known-bugs
```

These four tests encode the behavior `API_REFERENCE.md` requires. They **fail
today** against the current (buggy) API and will **pass once each bug is
fixed** — see [Bugs found](#bugs-found-part-b). They are excluded from the
default `npm test` (which stays green); run them only via the command above.

### Part C — load test

```bash
npm run api           # terminal 1
npm run k6:build      # bundle TypeScript scenarios into load/dist/
npm run k6:smoke      # terminal 2
```

## Continuous integration

[`.github/workflows/api-tests.yml`](./.github/workflows/api-tests.yml) runs the
functional suite on pull requests and pushes to `main`, and can be started
manually from the Actions tab.

- Ubuntu 24.04, Node.js 24, `npm ci`, then `npm test -- --forbid-only`.
- No browser is installed — the suite is API-only.
- The `@KnownBug` suite is excluded, so the job is expected to stay green.
- k6 is not run in CI; the load scenario is a local exercise.

`--forbid-only` fails the build if a stray `test.only` is committed, so a
focused test cannot silently narrow CI to a single case.

## Project layout

```
api/                                  Reminders API — system under test (unmodified)
  server.js, seed.js
tests/
  fixtures/
    api.fixture.ts                    request fixture + toHaveApiStatus matcher
    reminder.factory.ts               test-data factory
  api/reminders/
    Reminders_API.ts                  endpoint wrapper
    Reminders_Schema.ts               Zod schemas (reminder, list, error bodies)
    Reminders_List.spec.ts            GET /reminders coverage
    Reminders_Get.spec.ts             GET /reminders/{id} coverage
    Reminders_Create.spec.ts          POST /reminders coverage
    Reminders_Complete.spec.ts        POST /reminders/{id}/complete coverage
    Reminders_KnownBugs.spec.ts       Part B regression tests
load/
  scenarios/reminders-smoke.ts        k6 user-journey scenario
  profiles/smoke.ts                   load profile (2 VUs, 30s)
  shared/http.ts                      base URL helper
  esbuild.config.mjs                  bundles scenarios for k6
.github/workflows/api-tests.yml       CI — functional suite
API_REFERENCE.md                      the API contract
```

## Bugs found (Part B)

Four defects were confirmed against the running API. Each is guarded by a
regression test in `tests/api/reminders/Reminders_KnownBugs.spec.ts`, tagged
`@KnownBug`. These tests **fail today** (by design) and will **pass once the
bug is fixed**.

### Bug 1 — Pagination `total` counts only the current page
- **Endpoint:** `GET /reminders?page=1&pageSize=5`
- **Repro:** request any page with `pageSize` smaller than the dataset and read `total`.
- **Expected:** `total` = number of reminders matching the filter across *all* pages (e.g. 25 unfiltered), per `API_REFERENCE.md`.
- **Actual:** `total` equals the number of items on the current page (5).
- **Regression test:** `Known bug: pagination total` — asserts `total` exceeds a single full page.

### Bug 2 — `order=desc` is ignored
- **Endpoint:** `GET /reminders?sort=createdAt&order=desc`
- **Repro:** request a descending sort and inspect the order of `createdAt`.
- **Expected:** reminders sorted by `createdAt` descending.
- **Actual:** results are still ascending; the `order` parameter has no effect.
- **Regression test:** `Known bug: descending sort` — asserts the 25 seeded reminders come back in descending `createdAt` order.

### Bug 3 — Completing a nonexistent reminder returns 200 instead of 404
- **Endpoint:** `POST /reminders/does-not-exist/complete`
- **Repro:** POST the complete action for an id that does not exist.
- **Expected:** `404` (per `API_REFERENCE.md`).
- **Actual:** `200` with an empty object.
- **Regression test:** `Known bug: complete nonexistent reminder` — asserts a `404` status (the reference does not specify the body, so only status is checked).

### Bug 4 — Empty-string `title` is accepted
- **Endpoint:** `POST /reminders` with a valid body but `title: ""`
- **Repro:** create a reminder whose `title` is an empty string.
- **Expected:** `400` validation error (`title` must be non-empty, per `API_REFERENCE.md`).
- **Actual:** `201`; the reminder is created with an empty title.
- **Regression test:** `Known bug: empty title accepted` — asserts a `400` with the validation error shape.

> Note on sensitive data: the `notes` field is treated as sensitive. Tests
> avoid logging or asserting on its value, and the custom status matcher does
> not print response bodies.

## Load test results (Part C)

The scenario simulates a read-only user journey — search a filtered and sorted
list, page forward, then open one reminder's detail — with a fixed 0.5s think
time between steps. A custom `detail_fetch_duration` Trend isolates the
detail-fetch latency.

Figures from one observed local run — 2026-10-27, 2 VUs for 30 seconds,
k6 v2.3.0 on macOS, API on `localhost`:

| Measure | Observed |
|---|---|
| Iterations completed | 40 |
| HTTP requests | 120 |
| HTTP response time | avg 1.18 ms, p95 1.84 ms |
| `detail_fetch_duration` | avg 1.06 ms, p95 1.63 ms |
| HTTP failure rate | 0.00% |
| Functional checks | 240 / 240 passed |
| Thresholds | all passed (exit code 0) |

Each successful iteration issues three HTTP requests and runs six checks, which
is why this run recorded 120 requests and 240 checks across 40 iterations. The
scenario is time-based rather than iteration-capped, so the iteration count and
the latency figures will both vary between runs and between machines.

**What this shows:** In this local smoke run, all 240 checks passed, no HTTP
failures were recorded, and both observed p95 latency metrics stayed within
their configured thresholds.

**What this does not show:** the run uses localhost networking and only two
virtual users, so it does **not** represent realistic remote-network latency,
production database performance, or significant concurrent load. The sub-2ms
figures reflect an in-memory API on one machine, not a deployed environment. It
validates the scenario and gives a baseline, not a capacity estimate.

**Thresholds** (`http_req_duration` p95 < 500 ms, `http_req_failed` < 1%,
`checks` == 100%, `detail_fetch_duration` p95 < 500 ms) are chosen initial
smoke-test budgets, **not** official production SLAs.

## What I'd test next with more time

- Negative and malformed-input coverage for `GET /reminders` query parameters
  (invalid `sort` or `status`, very large `pageSize`).
- Pagination and sorting interaction verified across multiple pages end to end.
- Further `POST /reminders/{id}/complete` coverage beyond the existing
  success-path test: completing an already-`Done` reminder, and repeated
  completion of the same id. `API_REFERENCE.md` does not state whether the
  operation is idempotent or what a repeat call should return, so this needs a
  contract decision before it can be asserted.
- A per-test data reset or isolated store, to remove the shared-state
  constraints noted below.
- Expanded load testing: ramping virtual users, a larger dataset, and a
  non-local deployment.

## Known limitations

- **Shared API state:** the API keeps one in-memory store with no per-test
  reset. Tests are written to tolerate this (asserting on their own created
  records or on stable seeded data), but a reset hook would be cleaner.
- **Test isolation is by convention, not enforcement.** Specs run fully
  parallel against that shared store; isolation depends on each test asserting
  only on records it created or on immutable seeded data.
- **CI covers the functional suite only.** The `@KnownBug` suite and the k6
  scenario are run locally, not in GitHub Actions.
