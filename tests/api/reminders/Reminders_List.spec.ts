import { test, expect } from '@fixtures/api.fixture';
import { RemindersApi } from './Reminders_API';
import { ReminderListSchema } from './Reminders_Schema';
import { buildValidReminder } from '@fixtures/reminder.factory';

/**
 * Coverage for GET /reminders: shape, pagination, filtering, sorting.
 *
 * Read-only tests here assert against the seeded data in ways that stay stable
 * even though the API shares one in-memory store across all tests: created
 * reminders always sort *after* the seeded ones by createdAt (they are created
 * "now"), so the leading createdAt-ascending pages never shift. We never assert
 * on the sensitive `notes` field, and only compare ids/dates so a failure
 * message can't surface it.
 */
test.describe('Reminders list @ReadOnly', () => {
  test('returns 200 and a well-formed list @Healthcheck', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.list({ page: 1, pageSize: 5 });
    await expect(response).toHaveApiStatus(200);

    const body = await response.json();
    // Validate the response shape, not just the status.
    ReminderListSchema.parse(body);
    expect(body.items.length).toBeGreaterThan(0);
  });

  test('defaults to page 1 and pageSize 10 when omitted', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.list();
    await expect(response).toHaveApiStatus(200);

    const body = ReminderListSchema.parse(await response.json());
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
    expect(body.items).toHaveLength(10);
  });

  test('returns the expected slice and metadata for each page', async ({ request }) => {
    const api = new RemindersApi(request);

    const pageOneResp = await api.list({ page: 1, pageSize: 5 });
    await expect(pageOneResp).toHaveApiStatus(200);
    const pageOne = ReminderListSchema.parse(await pageOneResp.json());

    const pageTwoResp = await api.list({ page: 2, pageSize: 5 });
    await expect(pageTwoResp).toHaveApiStatus(200);
    const pageTwo = ReminderListSchema.parse(await pageTwoResp.json());

    // Default sort is createdAt asc; seeded reminders lead the list and are stable.
    expect(pageOne.items.map((i) => i.id)).toEqual(['r-001', 'r-002', 'r-003', 'r-004', 'r-005']);
    expect(pageTwo.items.map((i) => i.id)).toEqual(['r-006', 'r-007', 'r-008', 'r-009', 'r-010']);

    expect(pageOne.page).toBe(1);
    expect(pageOne.pageSize).toBe(5);
    expect(pageTwo.page).toBe(2);
    expect(pageTwo.pageSize).toBe(5);
  });

  test('a page far beyond the dataset returns 200 with an empty list', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.list({ page: 999, pageSize: 10 });
    await expect(response).toHaveApiStatus(200);

    const body = ReminderListSchema.parse(await response.json());
    expect(body.items).toHaveLength(0);
  });

  test('filtering by status only returns matching reminders', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.list({ status: 'Done', pageSize: 1000 });
    await expect(response).toHaveApiStatus(200);

    const body = ReminderListSchema.parse(await response.json());
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.status).toBe('Done');
    }
  });

  test('sorts by createdAt ascending by default', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.list({ pageSize: 1000 });
    await expect(response).toHaveApiStatus(200);

    const body = ReminderListSchema.parse(await response.json());
    const createdDates = body.items.map((i) => i.createdAt);
    expect(createdDates).toEqual([...createdDates].sort());
  });
});

/**
 * Sorting by a specific field, verified with controlled data.
 *
 * The seeded reminders have createdAt and dueDate in the same order, so a test
 * against seed data can't tell "sort by dueDate" apart from "sort by createdAt".
 * We create reminders whose dueDate order is the reverse of their creation
 * order, then confirm a dueDate-ascending request returns them in dueDate order
 * (which differs from creation order). This writes data, so it isn't @ReadOnly;
 * it stays parallel-safe by asserting only on the ids it created.
 */
test.describe('Reminders list sorting', () => {
  test('sorts by dueDate ascending independently of creation order', async ({ request }) => {
    const api = new RemindersApi(request);

    // Created in order a, b, c but with descending dueDate, so dueDate order is c, b, a.
    const a = buildValidReminder({ dueDate: '2027-03-01T00:00:00.000Z' });
    const b = buildValidReminder({ dueDate: '2027-02-01T00:00:00.000Z' });
    const c = buildValidReminder({ dueDate: '2027-01-01T00:00:00.000Z' });

    const created: string[] = [];
    for (const payload of [a, b, c]) {
      const resp = await api.create(payload);
      await expect(resp).toHaveApiStatus(201);
      created.push((await resp.json()).id);
    }
    const mine = new Set(created);

    const listResp = await api.list({ sort: 'dueDate', order: 'asc', pageSize: 1000 });
    await expect(listResp).toHaveApiStatus(200);
    const body = ReminderListSchema.parse(await listResp.json());

    const myDueDates = body.items.filter((i) => mine.has(i.id)).map((i) => i.dueDate);
    expect(myDueDates).toHaveLength(3);
    // If the API ignored the sort field and used createdAt, these would be descending.
    expect(myDueDates).toEqual([...myDueDates].sort());
  });
});

/**
 * Observed fallback behavior for invalid pagination input.
 *
 * NOTE: API_REFERENCE.md documents the defaults only for *omitted* params, not
 * what happens for invalid values (0, non-numeric). These tests pin the current
 * server behavior so a regression is visible, but they document observed
 * behavior, not a guaranteed contract.
 */
test.describe('Reminders list — observed pagination fallbacks @ReadOnly', () => {
  test('page=0 falls back to page 1', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.list({ page: 0, pageSize: 5 });
    await expect(response).toHaveApiStatus(200);
    const body = ReminderListSchema.parse(await response.json());
    expect(body.page).toBe(1);
  });

  test('non-numeric page falls back to page 1', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.list({ page: 'abc', pageSize: 5 });
    await expect(response).toHaveApiStatus(200);
    const body = ReminderListSchema.parse(await response.json());
    expect(body.page).toBe(1);
  });

  test('pageSize=0 falls back to the default pageSize', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.list({ pageSize: 0 });
    await expect(response).toHaveApiStatus(200);
    const body = ReminderListSchema.parse(await response.json());
    expect(body.pageSize).toBe(10);
    expect(body.items).toHaveLength(10);
  });
});
