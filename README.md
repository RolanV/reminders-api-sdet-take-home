# Reminders API — Test Automation

Automated tests for the **Reminders API**: a Playwright API suite (functional
coverage), a set of regression tests that guard four confirmed API defects, and
a k6 load scenario. Everything runs locally — no accounts or external services.

- **Part A** — functional API tests (`GET /reminders`, `GET /reminders/{id}`, `POST /reminders`)
- **Part B** — regression tests for four confirmed bugs (intentionally failing until fixed)
- **Part C** — a k6 load scenario simulating a realistic user journey

The API contract is in [`API_REFERENCE.md`](./API_REFERENCE.md). Files under
`api/` are the system under test and were not modified.

## Prerequisites

- **Node.js** 20 or newer.
- **k6** (Part C only) — `brew install k6`, or see https://grafana.com/docs/k6/latest/set-up/install-k6/.

## Setup

```bash
npm install
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
npx playwright test --grep-invert @KnownBug   # functional suite only
npm run test:smoke                            # @Healthcheck smoke subset
```

Coverage highlights:
- A thin API wrapper (`Reminders_API.ts`) and Zod schemas validate response
  **shape and types**, not just status codes.
- A test-data factory (`reminder.factory.ts`) builds valid/invalid payloads.
- Positive, negative, and edge cases across the three endpoints; smoke tests
  are tagged `@Healthcheck`.

### Part B — known-bug regression tests (expected to fail)

```bash
npx playwright test --grep @KnownBug
```

These four tests encode the behavior `API_REFERENCE.md` requires. They **fail
today** against the current (buggy) API and will **pass once each bug is
fixed** — see [Bugs found](#bugs-found-part-b). Note: the default `npm test`
has no tag filter, so it runs everything and will report the four intentional
failures; use the `--grep` / `--grep-invert` commands above to separate the
groups.

### Part C — load test

```bash
npm run api           # terminal 1
npm run k6:build      # bundle TypeScript scenarios into load/dist/
npm run k6:smoke      # terminal 2
```

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
    Reminders_KnownBugs.spec.ts       Part B regression tests (@KnownBug)
load/
  scenarios/reminders-smoke.ts        k6 user-journey scenario
  profiles/smoke.ts                   load profile (2 VUs, 30s)
  shared/http.ts                      base URL helper
  esbuild.config.mjs                  bundles scenarios for k6
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

The scenario simulates a read-only user journey — search a filtered/sorted
list, page forward, then open one reminder's detail — with a fixed 0.5s think
time between steps. A custom `detail_fetch_duration` Trend isolates the
detail-fetch latency.

Latest verified run (2 VUs, 30 seconds):

| Measure | Result |
|---|---|
| Iterations | 40 |
| HTTP requests | 120 |
| HTTP response time | avg 1.02 ms, p95 1.72 ms |
| `detail_fetch_duration` | avg 0.90 ms, p95 1.57 ms |
| HTTP failure rate | 0.00% |
| Functional checks | 240 / 240 passed |
| Thresholds | all passed (exit code 0) |

**What this shows:** the journey is wired correctly and the API responds
correctly and quickly under a light, realistic load (0% errors, all checks
passing, p95 well within budget).

**What this does not show:** the run uses localhost networking and only two
virtual users, so it does **not** represent realistic remote-network latency,
production database performance, or significant concurrent load. The sub-2ms
figures reflect an in-memory API on one machine, not a deployed environment. It
validates the scenario and gives a baseline, not a capacity estimate.

**Thresholds** (`http_req_duration` p95 < 500 ms, `http_req_failed` < 1%,
`checks` == 100%, `detail_fetch_duration` p95 < 500 ms) are our chosen initial
smoke-test budgets, **not** official production SLAs.

## What I'd test next with more time

- Negative/malformed-input coverage for `GET /reminders` query params (invalid `sort`/`status`, huge `pageSize`).
- Pagination and sorting interaction verified across multiple pages end to end.
- Success-path contract tests for `POST /reminders/{id}/complete` (idempotency, status transition).
- A per-test data reset or isolated store to remove the shared-state constraints noted below.
- Expanded load testing: ramping VUs, a larger dataset, and a non-local deployment.

## Known limitations

- **Shared API state:** the API keeps one in-memory store with no per-test
  reset. Tests are written to tolerate this (assert on their own created
  records or on stable seeded data), but a reset hook would be cleaner.
- **Pre-existing TypeScript errors (not introduced by these tests, left
  unfixed):** a strict `tsc --noEmit` reports two issues in skeleton files —
  an unused `@ts-expect-error` in `load/shared/http.ts`, and a `URLSearchParams`
  typing issue in `tests/api/reminders/Reminders_API.ts`. They don't affect the
  test run (Playwright and esbuild transpile the TypeScript), so they're
  documented rather than changed.
