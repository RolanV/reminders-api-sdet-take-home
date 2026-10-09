import type { ReminderInput } from '../api/reminders/Reminders_API';

let sequence = 0;

/**
 * Builds a valid reminder payload. Each call bumps a counter so
 * patientName/title/dueDate are unique across tests, which matters because
 * the API has no reset endpoint between tests — see README for details.
 *
 * `notes` is a placeholder value only. Per API_REFERENCE.md it's treated as
 * sensitive, so no test asserts on its content or logs it.
 */
export function buildValidReminder(overrides: Partial<ReminderInput> = {}): ReminderInput {
  sequence += 1;
  return {
    patientName: `Factory Patient ${sequence}`,
    title: `Factory Reminder ${sequence}`,
    notes: 'factory placeholder note',
    dueDate: new Date(Date.now() + sequence * 86_400_000).toISOString(),
    status: 'Open',
    ...overrides,
  };
}

/** A valid payload with one required field removed, to trigger "required" validation. */
export function buildReminderMissing(field: keyof ReminderInput): ReminderInput {
  const payload = buildValidReminder();
  delete payload[field];
  return payload;
}
