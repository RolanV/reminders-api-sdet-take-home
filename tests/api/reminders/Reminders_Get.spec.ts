import { test, expect } from '@fixtures/api.fixture';
import { RemindersApi } from './Reminders_API';
import { ReminderSchema, NotFoundErrorSchema } from './Reminders_Schema';
import { buildValidReminder } from '@fixtures/reminder.factory';

/**
 * Coverage for GET /reminders/{id}: fetch one reminder, and the 404 contract.
 *
 * We never assert on the sensitive `notes` field, so a failure message can't
 * surface it.
 */
test.describe('Reminders get by id @ReadOnly', () => {
  test('returns 200 and a well-formed reminder for a known id @Healthcheck', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.getById('r-001');
    await expect(response).toHaveApiStatus(200);

    const body = ReminderSchema.parse(await response.json());
    expect(body.id).toBe('r-001');
  });

  test('returns 404 with an error body for an unknown id', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.getById('does-not-exist');
    await expect(response).toHaveApiStatus(404);

    const body = NotFoundErrorSchema.parse(await response.json());
    expect(body.error.length).toBeGreaterThan(0);
  });

  test('returns 404 for an id that looks valid but was never created', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.getById('r-99999');
    await expect(response).toHaveApiStatus(404);
    NotFoundErrorSchema.parse(await response.json());
  });
});

/**
 * Cross-endpoint check: a reminder created via POST is retrievable by its id,
 * with the same values echoed back. Asserts only on its own created record, so
 * it is safe under the shared in-memory store and parallel execution.
 */
test.describe('Reminders get by id — created record', () => {
  test('a freshly created reminder can be fetched by its id', async ({ request }) => {
    const api = new RemindersApi(request);

    const payload = buildValidReminder();
    const createResp = await api.create(payload);
    await expect(createResp).toHaveApiStatus(201);
    const created = ReminderSchema.parse(await createResp.json());

    const getResp = await api.getById(created.id);
    await expect(getResp).toHaveApiStatus(200);
    const fetched = ReminderSchema.parse(await getResp.json());

    expect(fetched.id).toBe(created.id);
    expect(fetched.patientName).toBe(payload.patientName);
    expect(fetched.title).toBe(payload.title);
    expect(fetched.status).toBe('Open');
  });
});
