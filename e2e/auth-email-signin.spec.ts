import { test, expect } from '@playwright/test';
import {
  findUserByEmail,
  confirmUserEmail,
  deleteTestUser,
} from './utils/supabase-admin';

const TEST_EMAIL_PREFIX = 'e2e-test-signin-';
const TEST_PASSWORD = 'TestPass1!';

test.describe('Auth: Email signin', () => {
  let testEmail: string;
  let testUserId: string | null = null;

  test('user signs in and is redirected', async ({ page }) => {
    testEmail = `${TEST_EMAIL_PREFIX}${Date.now()}@test.homechef.local`;

    // Step 1: Sign up to create a user
    await page.goto('/login');
    await page.getByTestId('auth-toggle').click();
    await expect(page.getByTestId('auth-first-name')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('auth-first-name').fill('SignIn');
    await page.getByTestId('auth-last-name').fill('Test');
    await page.getByTestId('auth-email').fill(testEmail);
    await page.getByTestId('auth-password').fill(TEST_PASSWORD);
    await page.waitForTimeout(500);
    await page.getByTestId('auth-submit').click();

    await page.waitForURL(/\/(intro|auth\/callback)/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const user = await findUserByEmail(testEmail);
    expect(user, 'User should exist after signup').toBeTruthy();
    testUserId = user!.id;

    // Confirm email if required (allows signin without email verification)
    await confirmUserEmail(user!.id);

    // Step 2: Sign out (clear storage)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/login');
    await page.waitForTimeout(500);

    // Step 3: Sign in
    await page.getByTestId('auth-email').fill(testEmail);
    await page.getByTestId('auth-password').fill(TEST_PASSWORD);
    await page.getByTestId('auth-submit').click();

    // Should redirect to intro or callback
    await expect(page).toHaveURL(/\/(intro|auth\/callback)/, { timeout: 15000 });

    console.log('\n--- E2E Auth Signin Test Results ---');
    console.log('Email:', testEmail);
    console.log('Redirect: OK');
    console.log('------------------------------------\n');
  });

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId);
      testUserId = null;
    }
  });
});
