# E2E Testing Guide

End-to-end tests for the YourHomeChef app using Playwright. Tests run against the **web** build (`expo start --web`).

## Prerequisites

- Node.js 18+
- Supabase project (production or dedicated test project)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.test`

Copy the example and fill in your Supabase credentials:

```bash
cp .env.test.example .env.test
```

Required variables:

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (same as `.env`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service role key** – required for DB verification and test cleanup. Get it from Supabase Dashboard → Project Settings → API. |

Optional:

| Variable | Description |
|----------|-------------|
| `E2E_BASE_URL` | Override base URL (default: `http://localhost:8081`) |
| `GOOGLE_TEST_EMAIL` | Test Google account email (for Google OAuth tests) |
| `GOOGLE_TEST_PASSWORD` | Test Google account password |

> **Important:** Never commit `.env.test`. It contains secrets (service role key). `.env.test` is in `.gitignore`.

## Running Tests

### 1. Start the app (in one terminal)

```bash
npm run web
```

Wait until the app is ready at http://localhost:8081.

### 2. Run E2E tests (in another terminal)

```bash
npm run test:e2e
```

If the app is already running, Playwright will reuse it. Otherwise it will try to start it (may take 2–3 minutes).

### Run with visible browser

```bash
npm run test:e2e:headed
```

```bash
npm run test:e2e:headed
```

### Other commands

- `npm run test:e2e:ui` – Playwright UI mode (interactive)
- `npm run test:e2e:report` – Open the last HTML report

## Test Scenarios

### 1. Email signup

**File:** `e2e/auth-email-signup.spec.ts`

- User signs up with email, password, first name, last name, phone
- Verifies:
  - User exists in `auth.users`
  - Profile exists in `public.profiles` with correct name, email, phone
  - Row exists in `public.users` with correct name, email
- **Cleanup:** Deletes the test user after the test

### 2. Email signin

**File:** `e2e/auth-email-signin.spec.ts`

- Creates a user via signup, confirms email via Admin API
- Signs out (clears storage)
- Signs in with same credentials
- Verifies redirect to `/intro` or `/auth/callback`
- **Cleanup:** Deletes the test user after the test

### 3. Google signup

**File:** `e2e/auth-google-signup.spec.ts`

- Clicks "Continue with Google"
- Fills Google sign-in (requires `GOOGLE_TEST_EMAIL` and `GOOGLE_TEST_PASSWORD`)
- Verifies profile exists in Supabase with correct email
- **Skip:** Runs only if Google credentials are set
- **Cleanup:** Deletes test user only if email contains `e2e-test` (use a dedicated test Google account)

## Test Data

- **Email signup/signin:** Uses unique emails `e2e-test-{timestamp}@test.homechef.local` to avoid conflicts
- **Cleanup:** All test users are deleted after each test via Supabase Admin API
- **Production:** Tests use production Supabase with test-only emails. Cleanup ensures no leftover data

## Viewing Test Results

After a run, results are saved to:

- **HTML report:** `e2e-results/html/index.html`
- **Screenshots:** On failure only
- **Videos:** On first retry only

Open the report:

```bash
npm run test:e2e:report
```

## Troubleshooting

### "Missing SUPABASE_SERVICE_ROLE_KEY"

- Create `.env.test` with `SUPABASE_SERVICE_ROLE_KEY`
- Get it from Supabase Dashboard → Project Settings → API → `service_role` (secret)

### "User should exist in auth.users" fails

- Supabase may require email confirmation. Tests use Admin API to confirm.
- Check Supabase Auth → Settings → Email Auth. If "Confirm email" is enabled, tests should still pass (we call `confirmUserEmail`).

### Google test skipped

- Set `GOOGLE_TEST_EMAIL` and `GOOGLE_TEST_PASSWORD` in `.env.test`
- Use a dedicated test Google account (e.g. `e2e-test-yourhomechef@gmail.com`)
- Google may show CAPTCHA or block automated sign-in – tests can be flaky

### Port 8081 already in use

- Stop any process on 8081, or set `E2E_BASE_URL` to your app URL in `.env.test`

### testID not found

- Ensure the auth page has `testID` on inputs (e.g. `auth-email`, `auth-password`). These are added for E2E.
