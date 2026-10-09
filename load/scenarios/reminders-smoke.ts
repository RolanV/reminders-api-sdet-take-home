import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { smoke } from '../profiles/smoke';
import { url } from '../shared/http';

/**
 * k6 load scenario: a realistic read-only browsing journey against the
 * Reminders API.
 *
 *   1. search  — GET a filtered, sorted list (page 1)
 *   2. page    — GET the next page
 *   3. detail  — GET one reminder the user "saw" on page 1
 *
 * Fixed 0.5s think time between steps simulates a human reading each screen.
 * The journey is read-only (GETs only), so it never mutates API state and
 * cannot interfere with the Playwright suite.
 *
 * Sensitive data: response bodies are never logged. JSON is parsed only to
 * extract an `id`; on any parse/shape problem we record a failed check and
 * move on — we never print the body (which can contain the sensitive `notes`).
 *
 * Run:
 *   npm run api        # terminal 1
 *   npm run k6:build   # bundle scenarios to load/dist/
 *   npm run k6:smoke   # terminal 2
 */

// Custom metric: latency of just the detail fetch, separate from the aggregate.
const detailFetchDuration = new Trend('detail_fetch_duration', true);

export const options = {
  vus: smoke.vus,
  duration: smoke.duration,
  thresholds: {
    // Initial test budgets for this smoke run — not official SLAs/requirements.
    http_req_duration: ['p(95)<500'],
    // http_req_failed counts any unexpected status (4xx/5xx), not only transport errors.
    http_req_failed: ['rate<0.01'],
    // A functional check failure should fail the run, not just show in the summary.
    checks: ['rate==1.0'],
    // Same latency budget applied to the endpoint the user cares about most.
    detail_fetch_duration: ['p(95)<500'],
  },
};

const LIST_QUERY = 'status=Open&pageSize=5&sort=dueDate&order=asc';

/** Extract items[0].id from a list body, or null. Never logs the body. */
function firstItemId(body: string | null): string | null {
  try {
    const parsed = JSON.parse(String(body));
    const items = parsed && parsed.items;
    if (Array.isArray(items) && items.length > 0 && typeof items[0].id === 'string') {
      return items[0].id;
    }
  } catch (_e) {
    // Intentionally swallowed: do not log the body (may contain sensitive notes).
  }
  return null;
}

/** True if the body is JSON with an `items` array. False on invalid JSON. Never logs the body. */
function hasItemsArray(body: string | null): boolean {
  try {
    const parsed = JSON.parse(String(body));
    return Array.isArray(parsed && parsed.items);
  } catch (_e) {
    return false;
  }
}

/** Extract a top-level id from a detail body, or null. Never logs the body. */
function detailId(body: string | null): string | null {
  try {
    const parsed = JSON.parse(String(body));
    return parsed && typeof parsed.id === 'string' ? parsed.id : null;
  } catch (_e) {
    return null;
  }
}

export default function () {
  // Step 1 — search: filtered, sorted first page.
  const page1 = http.get(url(`/reminders?${LIST_QUERY}&page=1`), {
    tags: { name: 'GET /reminders (list)' },
  });
  check(page1, { 'list page 1 is 200': (r) => r.status === 200 });
  sleep(0.5);

  // Step 2 — page forward.
  const page2 = http.get(url(`/reminders?${LIST_QUERY}&page=2`), {
    tags: { name: 'GET /reminders (list)' },
  });
  check(page2, {
    'list page 2 is 200': (r) => r.status === 200,
    'list page 2 has an items array': (r) => hasItemsArray(r.body as string | null),
  });
  sleep(0.5);

  // Step 3 — detail: open an item seen on page 1. No hardcoded fallback id.
  const id = firstItemId(page1.body as string | null);
  const haveId = check(id, { 'page 1 yielded a reminder id to open': (v) => v !== null });

  if (haveId && id !== null) {
    const detail = http.get(url(`/reminders/${id}`), {
      // Static tag name so every dynamic id rolls up under one metric row.
      tags: { name: 'GET /reminders/{id}' },
    });
    detailFetchDuration.add(detail.timings.duration);
    check(detail, {
      'detail is 200': (r) => r.status === 200,
      'detail id matches requested': (r) => detailId(r.body as string | null) === id,
    });
  }
  sleep(0.5);
}
