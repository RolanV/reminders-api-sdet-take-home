import { test, expect } from '@fixtures/api.fixture';
import { RemindersApi } from './Reminders_API';
import { ReminderListSchema, ValidationErrorSchema } from './Reminders_Schema';
import { buildValidReminder } from '@fixtures/reminder.factory';

/**
 * KNOWN-BUG REGRESSION SUITE — these tests are EXPECTED TO FAIL against the
 * current API. Each encodes the behavior API_REFERENCE.md requires; each fails
 * today because of an intentional defect, and will pass once that defect is
 * fixed. They are isolated here and tagged @KnownBug so they can be run (or
 * excluded) on their own and never confused with an ordinary regression:
 *
 *   npx playwright test --grep-invert @KnownBug   # regular functional suite (expected green)
 *   npx playwright test --grep @KnownBug          # this suite (expected red today)
 *
 * NOTE: the default `npm test` has no grep filter, so it runs these too and
 * will report four intentional failures. Use the commands above to separate
 * the functional suite from the known-bug suite.
 *
 * Tests avoid logging or asserting on the sensitive `notes` field, and the
 * custom status matcher does not print response bodies.
 */

/**
 * Bug 1 — Pagination `total` reports the current page's item count, not the
 * total number of matching reminders across all pages.
 *
 * Repro:
 *   - GET /reminders?page=1&pageSize=5
 *   - Expected: total = count of ALL matching reminders (API_REFERENCE.md: total
 *     is "across all pages, not just the number returned on this page").
 *   - Actual:   total = 5 (the number of items on this page).
 *
 * Contract-based, race-free: records are only ever added (never deleted), so a
 * full first page plus a non-empty second page proves more than `pageSize`
 * reminders exist. `total` must therefore exceed a single page's size. This
 * avoids hardcoding the seed count of 25.
 */
test.describe('Known bug: pagination total @KnownBug @ReadOnly', () => {
  test('total reflects all matches, not just the current page', async ({ request }) => {
    const api = new RemindersApi(request);
    const pageSize = 5;

    const pageOne = ReminderListSchema.parse(await (await api.list({ page: 1, pageSize })).json());
    const pageTwo = ReminderListSchema.parse(await (await api.list({ page: 2, pageSize })).json());

    expect(pageOne.items).toHaveLength(pageSize); // first page is full
    expect(pageTwo.items.length).toBeGreaterThan(0); // more than one page of data exists

    // The contract: total counts every match across pages, so it must be larger
    // than a single full page. Fails now (total === pageSize); passes once fixed.
    expect(pageOne.total).toBeGreaterThan(pageSize);
  });
});

/**
 * Bug 2 — `order=desc` is ignored; results always come back ascending.
 *
 * Repro:
 *   - GET /reminders?sort=createdAt&order=desc
 *   - Expected: reminders sorted by createdAt descending.
 *   - Actual:   still ascending (the `order` param has no effect).
 *
 * We check only the seeded reminders (r-001..r-025), whose createdAt values are
 * fixed and immutable, so created records (r-026+) can't perturb the ordering.
 * All 25 are compared, which is more than enough to prove direction.
 */
test.describe('Known bug: descending sort @KnownBug @ReadOnly', () => {
  test('order=desc returns createdAt in descending order', async ({ request }) => {
    const api = new RemindersApi(request);

    const seededIds = new Set(
      Array.from({ length: 25 }, (_, i) => `r-${String(i + 1).padStart(3, '0')}`),
    );

    const body = ReminderListSchema.parse(
      await (await api.list({ sort: 'createdAt', order: 'desc', pageSize: 1000 })).json(),
    );

    const seededCreated = body.items.filter((i) => seededIds.has(i.id)).map((i) => i.createdAt);
    expect(seededCreated).toHaveLength(25); // all seeded reminders present

    const descending = [...seededCreated].sort().reverse();
    // Fails now (API returns ascending); passes once order=desc is honored.
    expect(seededCreated).toEqual(descending);
  });
});

/**
 * Bug 3 — Completing a nonexistent reminder returns 200 instead of 404.
 *
 * Repro:
 *   - POST /reminders/does-not-exist/complete
 *   - Expected: 404 (API_REFERENCE.md: "404 if no reminder has that id").
 *   - Actual:   200 with an empty object.
 *
 * API_REFERENCE.md does not specify the 404 body for this endpoint, so we only
 * assert the status code — not any particular error-body structure.
 */
test.describe('Known bug: complete nonexistent reminder @KnownBug', () => {
  test('returns 404 when the reminder id does not exist', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.complete('does-not-exist');
    // Fails now (API returns 200); passes once the handler 404s for unknown ids.
    await expect(response).toHaveApiStatus(404);
  });
});

/**
 * Bug 4 — An empty-string title is accepted on create.
 *
 * Repro:
 *   - POST /reminders with a valid body but title: ""
 *   - Expected: 400 (API_REFERENCE.md: "title ... must be non-empty").
 *   - Actual:   201; the reminder is created with an empty title.
 */
test.describe('Known bug: empty title accepted @KnownBug', () => {
  test('rejects an empty-string title with 400', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.create(buildValidReminder({ title: '' }));
    // Fails now (API returns 201); passes once empty titles are rejected.
    await expect(response).toHaveApiStatus(400);
    ValidationErrorSchema.parse(await response.json());
  });
});
