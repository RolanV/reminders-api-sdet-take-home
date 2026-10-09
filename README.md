# TrendConnect Test Automation Take-Home

Welcome, and thanks for taking the time. This repo contains a small **Reminders API** and a test skeleton. Your job is to test it: write API tests, hunt for bugs and guard against them, and run a quick load check.

Everything runs locally. No accounts, no VPN, no external services.

> The full exercise description (the three parts, weighting, and how we evaluate) is in the brief we emailed you. This README is just how to run things.

## Prerequisites

- **Node.js** 20 or newer
- **k6** for Part C only. Install: https://grafana.com/docs/k6/latest/set-up/install-k6/

## Setup

```bash
npm install
npx playwright install chromium
```

## Run the API

```bash
npm run api
```

The API listens on `http://localhost:3000` and resets its data every time it starts. See [`API_REFERENCE.md`](./API_REFERENCE.md) for the contract.

You do **not** need to modify anything in `api/`. Treat it as a black box and test it over HTTP.

## Run the tests

```bash
npm test              # runs all Playwright tests (auto-starts the API)
npm run test:smoke    # runs only @Healthcheck tests
```

Playwright is configured to start the API for you, so `npm test` works on its own. If you prefer, run `npm run api` in one terminal and the tests in another.

## Run the load scenario (Part C)

```bash
npm run api           # terminal 1
npm run k6:build      # bundle the TypeScript scenarios into load/dist/
npm run k6:smoke      # terminal 2: runs load/dist/reminders-smoke.js
```

## Where things live

```
api/                         The Reminders API (do not modify)
  server.js
  seed.js
tests/
  fixtures/
    api.fixture.ts           test fixture + toHaveApiStatus matcher
  api/reminders/
    Reminders_API.ts         example endpoint wrapper
    Reminders_Schema.ts      example Zod schemas
    Reminders_List.spec.ts   example spec (start here)
load/
  esbuild.config.mjs         bundles scenarios for k6
  profiles/smoke.ts          load profile
  shared/http.ts             base URL helper
  scenarios/reminders-smoke.ts   example k6 scenario (start here)
API_REFERENCE.md             the API contract
```

## Bugs found (Part B)

Four defects were confirmed against the running API. Each is guarded by a
regression test in `tests/api/reminders/Reminders_KnownBugs.spec.ts`, tagged
`@KnownBug`. These tests **fail today** (by design) and will **pass once the
bug is fixed**.

The default `npm test` has no tag filter, so it runs these four alongside the
functional tests and will report **four intentional failures**. Use the grep
flags below to run the two groups separately:

```bash
npx playwright test --grep-invert @KnownBug   # functional suite — expected green
npx playwright test --grep @KnownBug          # known-bug suite — expected red today
```

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

## What to put in your submission

Please update this README (or add a `NOTES.md`) with:

- **Bugs you found** — a short repro for each (endpoint, input, expected vs. actual).
- **Load results** — a couple of sentences reading your k6 run.
- **What you'd do next** with more time.

If you ran out of time on anything, just say so. That's good judgment, not a gap.

Good luck.
