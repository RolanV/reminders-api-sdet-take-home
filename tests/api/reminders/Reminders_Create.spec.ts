import { test, expect } from '@fixtures/api.fixture';
import { RemindersApi } from './Reminders_API';
import { ReminderSchema, ValidationErrorSchema } from './Reminders_Schema';
import { buildValidReminder, buildReminderMissing } from '@fixtures/reminder.factory';

/**
 * Coverage for POST /reminders: happy-path creation and validation (400s).
 *
 * The confirmed empty-string-title defect is intentionally NOT tested here; it
 * lives in the Part B regression suite. We never assert on the sensitive
 * `notes` field.
 */
test.describe('Reminders create — happy path', () => {
  test('creates a reminder and returns 201 with a well-formed body @Healthcheck', async ({ request }) => {
    const api = new RemindersApi(request);

    const payload = buildValidReminder();
    const response = await api.create(payload);
    await expect(response).toHaveApiStatus(201);

    const body = ReminderSchema.parse(await response.json());
    expect(body.id).toMatch(/^r-\d+$/);
    expect(body.patientName).toBe(payload.patientName);
    expect(body.title).toBe(payload.title);
    expect(body.dueDate).toBe(payload.dueDate);
    expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);
  });

  test('defaults status to Open when omitted', async ({ request }) => {
    const api = new RemindersApi(request);

    const payload = buildValidReminder();
    delete payload.status;

    const response = await api.create(payload);
    await expect(response).toHaveApiStatus(201);

    const body = ReminderSchema.parse(await response.json());
    expect(body.status).toBe('Open');
  });

  test('honors an explicit status of Done', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.create(buildValidReminder({ status: 'Done' }));
    await expect(response).toHaveApiStatus(201);

    const body = ReminderSchema.parse(await response.json());
    expect(body.status).toBe('Done');
  });
});

/**
 * Validation failures. Each sends an otherwise-valid payload with a single
 * problem and expects a 400 whose body matches the error schema.
 */
test.describe('Reminders create — validation @ReadOnly', () => {
  for (const field of ['patientName', 'title', 'dueDate'] as const) {
    test(`rejects a missing ${field} with 400`, async ({ request }) => {
      const api = new RemindersApi(request);

      const response = await api.create(buildReminderMissing(field));
      await expect(response).toHaveApiStatus(400);
      const body = ValidationErrorSchema.parse(await response.json());
      // Verify the error identifies the offending field, without pinning the exact wording.
      expect(body.errors.some((e) => e.includes(field))).toBe(true);
    });
  }

  test('rejects a non-date dueDate with 400', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.create(buildValidReminder({ dueDate: 'not-a-date' }));
    await expect(response).toHaveApiStatus(400);
    ValidationErrorSchema.parse(await response.json());
  });

  test('rejects an invalid status with 400', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.create(buildValidReminder({ status: 'Pending' }));
    await expect(response).toHaveApiStatus(400);
    ValidationErrorSchema.parse(await response.json());
  });

  test('rejects an empty body with 400 listing every missing field', async ({ request }) => {
    const api = new RemindersApi(request);

    const response = await api.create({});
    await expect(response).toHaveApiStatus(400);
    const body = ValidationErrorSchema.parse(await response.json());
    expect(body.errors.length).toBeGreaterThanOrEqual(3);
  });
});
