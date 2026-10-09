import { test, expect } from '@fixtures/api.fixture';
import { RemindersApi } from './Reminders_API';
import { ReminderSchema } from './Reminders_Schema';
import { buildValidReminder } from '@fixtures/reminder.factory';

/**
 * Coverage for POST /reminders/{id}/complete — the success path.
 *
 * The test creates its own reminder and asserts only on that record, so it is
 * safe under the shared in-memory store and parallel execution. It is not
 * @ReadOnly because it creates and mutates data. It never asserts on `notes`.
 */
test.describe('Reminders complete', () => {
  test('completing a reminder sets its status to Done', async ({ request }) => {
    const api = new RemindersApi(request);

    const createResp = await api.create(buildValidReminder());
    await expect(createResp).toHaveApiStatus(201);
    const created = ReminderSchema.parse(await createResp.json());

    const completeResp = await api.complete(created.id);
    await expect(completeResp).toHaveApiStatus(200);
    const completed = ReminderSchema.parse(await completeResp.json());
    expect(completed.id).toBe(created.id);
    expect(completed.status).toBe('Done');

    // Confirm the change persisted, not just echoed in the complete response.
    const getResp = await api.getById(created.id);
    await expect(getResp).toHaveApiStatus(200);
    const fetched = ReminderSchema.parse(await getResp.json());
    expect(fetched.status).toBe('Done');
  });
});
