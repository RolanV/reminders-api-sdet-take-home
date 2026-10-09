import { test as base, expect as baseExpect, APIResponse } from '@playwright/test';

/**
 * Custom matcher: toHaveApiStatus.
 *
 * On failure it prints the endpoint and the expected vs. actual status. It
 * deliberately does NOT print the response body: reminder bodies can contain
 * the sensitive `notes` field, which must not leak into test reports.
 *
 * Usage:  await expect(response).toHaveApiStatus(200);
 */
export const expect = baseExpect.extend({
  async toHaveApiStatus(response: APIResponse, expectedStatus: number) {
    const actualStatus = response.status();
    if (actualStatus === expectedStatus) {
      return { pass: true, message: () => '' };
    }
    const endpoint = new URL(response.url()).pathname;
    return {
      pass: false,
      message: () =>
        `API ${endpoint}\n` +
        `  Expected status: ${expectedStatus}\n` +
        `  Received status: ${actualStatus}`,
    };
  },
});

/**
 * The `api` fixture is an authenticated-style request context pointed at the
 * Reminders API base URL. For this exercise there is no real auth, so it is a
 * plain request context. In the real TC2 suite this is where per-user auth
 * state is attached.
 */
export const test = base;
