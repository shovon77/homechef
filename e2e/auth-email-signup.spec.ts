import { test, expect } from '@playwright/test';
import {
  findUserByEmail,
  getProfile,
  getUser,
  confirmUserEmail,
  deleteTestUser,
  adminClient,
} from './utils/supabase-admin';

const TEST_EMAIL_PREFIX = 'e2e-test-';
const TEST_PASSWORD = 'TestPass1!';

test.describe('Auth: Email signup', () => {
  let testEmail: string;
  let testUserId: string | null = null;

  test.beforeEach(() => {
    testEmail = `${TEST_EMAIL_PREFIX}${Date.now()}@test.homechef.local`;
  });

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId);
      testUserId = null;
    }
  });

  test('user signups for app and user details are captured in Supabase', async ({ page }) => {
    await page.goto('/signup');

    // Wait for signup form (first name, last name visible)
    await expect(page.getByTestId('auth-first-name')).toBeVisible({ timeout: 5000 });

    // Fill signup form
    await page.getByTestId('auth-first-name').fill('E2E');
    await page.getByTestId('auth-last-name').fill('TestUser');
    await page.getByTestId('auth-phone').fill('+15551234567');
    await page.getByTestId('auth-email').fill(testEmail);
    await page.getByTestId('auth-password').fill(TEST_PASSWORD);

    // Wait for password strength to be strong (5/5) and button enabled
    await page.waitForTimeout(500);
    await page.getByTestId('auth-submit').click();

    // Wait for either redirect to intro or auth callback
    await page.waitForURL(/\/(intro|auth\/callback)/, { timeout: 15000 }).catch(() => {});

    // Give ensureUser time to run
    await page.waitForTimeout(2000);

    // Verify user exists in Supabase (requires SUPABASE_SERVICE_ROLE_KEY in .env.test)
    const user = await findUserByEmail(testEmail);
    expect(
      user,
      `User ${testEmail} should exist in auth.users. Ensure SUPABASE_SERVICE_ROLE_KEY is set in .env.test`
    ).toBeTruthy();
    testUserId = user!.id;

    // Verify profile in public.profiles
    const profile = await getProfile(user!.id);
    expect(profile, 'Profile should exist').toBeTruthy();
    expect(profile!.email?.toLowerCase()).toBe(testEmail.toLowerCase());
    expect(profile!.name).toBe('E2E TestUser');
    expect(profile!.phone).toBe('+15551234567');

    // Verify users table
    const usersRow = await getUser(user!.id);
    expect(usersRow, 'users row should exist').toBeTruthy();
    expect(usersRow!.email?.toLowerCase()).toBe(testEmail.toLowerCase());
    expect(usersRow!.name).toBe('E2E TestUser');

    // Output test results
    console.log('\n--- E2E Auth Signup Test Results ---');
    console.log('Email:', testEmail);
    console.log('User ID:', user!.id);
    console.log('Profile name:', profile!.name);
    console.log('Profile phone:', profile!.phone);
    console.log('Profile email:', profile!.email);
    console.log('users.name:', usersRow!.name);
    console.log('------------------------------------\n');
  });
});
