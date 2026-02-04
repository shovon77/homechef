import { test, expect } from '@playwright/test';
import {
  findUserByEmail,
  getProfile,
  deleteTestUser,
} from './utils/supabase-admin';

const GOOGLE_EMAIL = process.env.GOOGLE_TEST_EMAIL;
const GOOGLE_PASSWORD = process.env.GOOGLE_TEST_PASSWORD;
const HAS_GOOGLE_CREDENTIALS = !!(GOOGLE_EMAIL && GOOGLE_PASSWORD);

test.describe('Auth: Google signup', () => {
  let testUserId: string | null = null;

  test.skip(!HAS_GOOGLE_CREDENTIALS, 'Set GOOGLE_TEST_EMAIL and GOOGLE_TEST_PASSWORD in .env.test to run');

  test('user signups with Google and details are captured in Supabase', async ({ page }) => {
    await page.goto('/auth');

    // Click Google button
    await page.getByTestId('auth-google').click();

    // Wait for redirect to accounts.google.com
    await page.waitForURL(/accounts\.google\.com/, { timeout: 10000 });

    // Fill Google sign-in (email)
    await page.getByRole('textbox', { name: /email|phone/i }).fill(GOOGLE_EMAIL!);
    await page.getByRole('button', { name: /next/i }).click();

    // Fill password
    await page.waitForTimeout(1500);
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.fill(GOOGLE_PASSWORD!);
    await page.getByRole('button', { name: /next/i }).click();

    // Handle "Use another account" or consent - wait for redirect back to app
    await page.waitForURL(/\/(intro|auth\/callback|auth)/, { timeout: 20000 });

    // Give ensureProfile/callback time to run
    await page.waitForTimeout(3000);

    // Verify user exists (by Google email)
    const user = await findUserByEmail(GOOGLE_EMAIL!);
    expect(user, `User ${GOOGLE_EMAIL} should exist in auth.users`).toBeTruthy();
    testUserId = user!.id;

    // Verify profile in public.profiles
    const profile = await getProfile(user!.id);
    expect(profile, 'Profile should exist').toBeTruthy();
    expect(profile!.email?.toLowerCase()).toBe(GOOGLE_EMAIL!.toLowerCase());
    // Name may come from Google user_metadata
    expect(profile!.id).toBe(user!.id);

    console.log('\n--- E2E Google Signup Test Results ---');
    console.log('Email:', GOOGLE_EMAIL);
    console.log('User ID:', user!.id);
    console.log('Profile name:', profile!.name);
    console.log('Profile email:', profile!.email);
    console.log('--------------------------------------\n');
  });

  test.afterEach(async () => {
    // Only delete if we used a dedicated test account - be careful with real Google accounts
    if (testUserId && GOOGLE_EMAIL?.includes('e2e-test') && GOOGLE_EMAIL?.includes('@')) {
      await deleteTestUser(testUserId);
    }
    testUserId = null;
  });
});
