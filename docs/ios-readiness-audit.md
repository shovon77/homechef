# HomeChef iOS Readiness Audit

**Created:** 2026-06-11  
**Repo:** `homechef` (Expo SDK 54, React Native 0.82, expo-router 6)  
**Purpose:** Reference plan for shipping a native iOS app from the existing Expo codebase. Use with Cursor / Claude Fable for implementation sprints.

---

## Executive summary

HomeChef is **not a plain web app** — it is already an **Expo / React Native** project with shared screens, native auth storage (`AsyncStorage`), and several native code paths. You are **finishing and hardening** iOS, not rewriting from scratch.

| Milestone | Realistic timeline (1 dev + AI assist) |
|-----------|----------------------------------------|
| First simulator build | 1–3 days |
| Core flows working on device | 1–2 weeks |
| TestFlight beta | 2–3 weeks |
| App Store v1 | 4–6 weeks |

**Biggest gaps:** deep links (auth + Stripe return), OAuth on native, missing native dependencies/permissions, and device QA — not UI rewrite.

---

## What already works (head start)

| Area | Evidence | Notes |
|------|----------|-------|
| Expo + iOS script | `package.json` → `npm run ios` | Managed workflow; no committed `Podfile` yet |
| App identity | `app.config.ts` → `bundleIdentifier: com.homechef.app`, `scheme: homechef` | Deep link base: `homechef://` |
| Routing | `expo-router` file-based routes | Same routes on web and native |
| Supabase auth storage | `lib/supabase.ts` uses `AsyncStorage` on native | Session persistence OK |
| Auth redirect helpers | `lib/authRedirect.ts` → `Linking.createURL('/auth/callback')` on native | **Must be allowlisted in Supabase** |
| Checkout → Stripe | `app/checkout/index.tsx` uses `Linking.openURL(url)` on native | Opens Safari; return path is the problem |
| Calendar (pickup) | `lib/addPickupCalendarEvent.ts` uses `expo-calendar` on native | Plugin + permission string already in `app.config.ts` |
| Delivery zone map (chef) | `DeliveryRegionMapPicker.tsx` (native) vs `.web.tsx` | Static Google Static Maps image on native — OK |
| Location autocomplete | `LocationPicker` → Supabase `google-places-autocomplete` edge function | Works on native (no browser CORS) |
| Geocoding | `resolveAddressCoords()` → `google-geocode-forward` edge function | Prefer this over Nominatim on native |
| Chef Stripe onboarding | `PayoutSettings.tsx` → `Linking.openURL` | Same Safari-return pattern as checkout |
| Screen shell | `components/Screen.tsx` includes `NavBar` + `Footer` | Most pages use this |

---

## Critical blockers (P0) — fix before TestFlight

### 1. Stripe checkout does not return to the app

**Files:** `app/checkout/index.tsx`, `lib/orders.ts`, `app/order/success.tsx`

**Today:**
- Native checkout opens Stripe in Safari via `Linking.openURL`.
- `successUrl` / `cancelUrl` point at `https://yourhomechef.ca/order/success?...` and `/cart` (`ENV.WEB_BASE_URL`).
- User completes payment on the **website**, not inside the app.

**Required:**
- [ ] Add **Universal Links** (recommended) or custom scheme return URLs for order success/cancel.
  - Example success: `homechef://order/success?orderId={ORDER_ID}` **or** `https://yourhomechef.ca/order/success?orderId=...` with Associated Domains.
- [ ] Update `create-checkout` success/cancel URL generation on native to use app deep links.
- [ ] Ensure `app/order/success.tsx` loads correctly from deep link (session restore logic already exists).
- [ ] Test full loop: cart → checkout → Safari Stripe → back to app → order confirmed.

**Estimate:** 2–4 days

---

### 2. Google OAuth not wired for native

**Files:** `app/auth/AuthScreen.tsx`, `app/auth/callback.tsx`, `lib/authRedirect.ts`

**Today:**
- `signInWithOAuth({ provider: 'google', options: { redirectTo } })` with no `skipBrowserRedirect` / in-app browser flow.
- **No** `expo-web-browser` or `expo-auth-session` in `package.json`.
- **No** `WebBrowser.maybeCompleteAuthSession()` or `Linking` listener for auth completion.
- `app/auth/callback.tsx` exchanges PKCE `code` on **web only**; native path only calls `getSession()` and fails if no session.

**Required:**
- [ ] Add `expo-web-browser` (+ typically `expo-auth-session`).
- [ ] Implement native OAuth: open auth URL in `WebBrowser.openAuthSessionAsync`, parse redirect, `exchangeCodeForSession`.
- [ ] Add global deep-link handler (or enhance callback route) for `homechef://auth/callback?code=...`.
- [ ] Supabase Dashboard → Authentication → URL Configuration:
  - Add `homechef://auth/callback`
  - Add `homechef://**` if supported
- [ ] Test: Google sign-in, magic link email, password reset on physical device.

**Estimate:** 2–3 days

---

### 3. Supabase redirect URL allowlist

**Console:** Supabase → Auth → URL Configuration

**Add (minimum):**
```
homechef://auth/callback
homechef://order/success
homechef://cart
```

If using Universal Links:
```
https://yourhomechef.ca/auth/callback
https://yourhomechef.ca/order/success
```

**Estimate:** 30 minutes (+ Apple Associated Domains setup if using HTTPS links)

---

### 4. EAS Build pipeline missing

**Today:** No `eas.json`, no documented iOS build profile.

**Required:**
- [ ] `npm install -g eas-cli` (or use `npx eas`)
- [ ] `eas build:configure`
- [ ] Apple Developer account ($99/yr), App Store Connect app record
- [ ] iOS distribution certificate + provisioning profile (EAS manages this)
- [ ] First `eas build --platform ios` (simulator, then device)
- [ ] `eas submit` or manual TestFlight upload

**Estimate:** 1–2 days (mostly Apple account + first build debugging)

---

## High priority (P1) — needed for beta quality

### 5. Missing native dependency: `expo-document-picker`

**File:** `components/FilePicker.tsx`

Native path calls `require('expo-document-picker')` but it is **not** in `package.json`. Chef/admin file uploads will fail.

- [ ] `npx expo install expo-document-picker`
- [ ] Verify upload flows: chef logo, dish images, issue report attachments (`app/order/success.tsx`)

**Estimate:** 0.5 day

---

### 6. iOS permission strings (`Info.plist`)

**File:** `app.config.ts`

**Missing usage descriptions** (will crash or be rejected without them):

| Permission | Used by | Suggested key |
|------------|---------|---------------|
| Photo library | `expo-image-picker` in `app/chef/profile/index.tsx`, chef onboarding | `NSPhotoLibraryUsageDescription` |
| Camera (if used) | Image picker camera mode | `NSCameraUsageDescription` |
| Location | NavBar “enable location”, browse distance | `NSLocationWhenInUseUsageDescription` |

**Today:** NavBar `handleEnableLocation()` uses `navigator.geolocation` — **web API only**. On native this will fail.

- [ ] Add `expo-location` and branch NavBar / cart location flows
- [ ] Add `expo-image-picker` plugin config in `app.config.ts` for iOS strings
- [ ] Add location permission copy

**Estimate:** 1–2 days

---

### 7. Navbar geolocation on native

**File:** `components/NavBar.tsx` (~line 761)

Uses `navigator.geolocation` without a native fallback.

- [ ] Use `expo-location` `requestForegroundPermissionsAsync` + `getCurrentPositionAsync`
- [ ] Reverse geocode via existing `google-geocode` edge function (same as web cart flow)

**Estimate:** 0.5–1 day

---

### 8. Environment variables for native builds

**File:** `.env.example` (incomplete for mobile)

**Required in EAS secrets / `.env` for iOS builds:**
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_WEB_BASE_URL=https://yourhomechef.ca
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY   # delivery map static images + edge functions
```

Stripe publishable key is server-side for Checkout redirect — confirm edge functions use prod keys in release builds.

- [ ] Document all `EXPO_PUBLIC_*` vars in `.env.example`
- [ ] Configure EAS environment secrets for `production` profile

**Estimate:** 0.5 day

---

### 9. Auth callback native PKCE exchange

**File:** `app/auth/callback.tsx`

Native branch does not call `completeAuthFromUrl()` when opened with `?code=` from deep link.

- [ ] On native, read `code` / `token_hash` from `useLocalSearchParams` (or `Linking.getInitialURL()`)
- [ ] Run same `completeAuthFromUrl` exchange as web
- [ ] Add `Linking.addEventListener('url', ...)` in root layout for warm-start deep links

**Estimate:** 1 day (often done together with P0 #2)

---

## Medium priority (P2) — polish before App Store

### 10. Web-only features (graceful degradation — verify UX)

| Feature | File | Native behavior today |
|---------|------|------------------------|
| Voice input (order issue / message) | `app/order/success.tsx` | Disabled on native (`Platform.OS !== 'web'`) — OK |
| Interactive delivery map | `DeliveryRegionMapPicker.web.tsx` | Static map on native — OK for v1 |
| Framer Motion nav animations | `components/NavBar.tsx` | Falls back to RN `TouchableOpacity` — OK |
| Vercel Analytics / Speed Insights | `app/_layout.tsx` | May no-op or warn — verify; consider gating with `Platform.OS === 'web'` |
| `window` / `document` in chef profile | `app/chef/profile/index.tsx` | Audit remaining web-only branches |
| Speech / WebRTC | — | N/A |

- [ ] Smoke-test each screen on iOS simulator; log crashes from `window` access
- [ ] Gate `@vercel/analytics` to web only if it causes native warnings

**Estimate:** 2–3 days QA + small fixes

---

### 11. Stripe Connect chef onboarding return

**File:** `components/chef/PayoutSettings.tsx`

Opens Stripe Connect in Safari. After onboarding, chef lands on Stripe/hosted page — not automatically back in app.

- [ ] Set Stripe Connect `return_url` / `refresh_url` to deep link or universal link
- [ ] Handle return route in app (refresh payout status)

**Estimate:** 1 day

---

### 12. App Store assets & metadata

- [ ] App icon: `assets/AppLogoFinal2026.png` — verify 1024×1024 App Store icon
- [ ] Splash screen: `expo-splash-screen` already imported in `_layout.tsx`
- [ ] Screenshots (6.7", 6.1", iPad if supporting tablet)
- [ ] Privacy Nutrition Labels (location, photos, purchase history, contact info)
- [ ] App Review notes: marketplace / food ordering / Stripe payments

**Estimate:** 1–2 days

---

### 13. iPad layout

Navbar tablet fixes were done for **web** viewport widths. Native iPad uses the same RN components — verify `useWindowDimensions()` breakpoints on iPad simulator.

- [ ] Test iPhone + iPad simulators
- [ ] Do **not** change mobile navbar logic without explicit tablet-only guards (lesson learned)

**Estimate:** 1 day QA

---

## Lower priority (P3) — post-v1

- [ ] Push notifications (`expo-notifications`) for order ready / new order (chef)
- [ ] Apple Pay (would need Stripe Payment Element native SDK — significant work)
- [ ] Offline / poor network handling
- [ ] `react-native-maps` for interactive chef delivery zones on native
- [ ] Remove dead import: `NavBar` imported but unused in `app/_layout.tsx` (cleanup only)

---

## File-by-file: `Platform.OS === 'web'` audit

These files contain web branches and should be spot-checked on iOS:

| File | Risk | Priority |
|------|------|----------|
| `app/auth/callback.tsx` | Auth broken on native | P0 |
| `app/checkout/index.tsx` | Checkout URLs | P0 |
| `app/order/success.tsx` | Post-payment + uploads | P0 |
| `app/auth/AuthScreen.tsx` | OAuth | P0 |
| `components/NavBar.tsx` | Geolocation | P1 |
| `components/FilePicker.tsx` | Missing dependency | P1 |
| `app/chef/profile/index.tsx` | Image upload, web DOM | P1 |
| `app/auth/chef.tsx` | Long onboarding form | P1 |
| `app/cart.tsx` | Location + geocode | P1 |
| `app/browse/index.tsx` | Distance sort geocoding | P2 |
| `app/index.tsx` | Homepage geocode chunk | P2 |
| `components/chef/PayoutSettings.tsx` | Stripe Connect external | P2 |
| `lib/geocode.ts` | Nominatim fallback slow on mobile | P2 |
| `app/_layout.tsx` | Web-only auth URL forwarding | P2 (native uses deep links instead) |

**Web-only components (auto-excluded on native):**
- `components/chef/DeliveryRegionMapPicker.web.tsx`
- `components/VercelSpeedInsights.web.tsx`

---

## Recommended implementation order (for Fable / AI sprints)

Copy each block as a focused Cursor task.

### Sprint 1 — Boot & build (Days 1–3)
1. `npx expo install expo-web-browser expo-auth-session expo-location expo-document-picker`
2. Run `npx expo run:ios` — fix Metro / TypeScript crashers
3. Add `eas.json` + first simulator build
4. Add iOS permission strings to `app.config.ts`

### Sprint 2 — Auth deep links (Days 4–6)
1. Native Google OAuth with `WebBrowser.openAuthSessionAsync`
2. Native PKCE exchange in `app/auth/callback.tsx`
3. `Linking` listener in `app/_layout.tsx`
4. Supabase redirect URL allowlist
5. Test: sign up, login, password reset, magic link

### Sprint 3 — Payments return path (Days 7–10)
1. Define deep link or universal link strategy for order success/cancel
2. Update checkout `successUrl` / `cancelUrl` on native
3. Apple Associated Domains (if using HTTPS universal links)
4. End-to-end test: browse → cart → checkout → pay → app order success

### Sprint 4 — Native gaps (Days 11–14)
1. Fix `FilePicker` / image picker permissions
2. NavBar + cart location with `expo-location`
3. Chef profile & dish upload QA on device
4. Stripe Connect return URLs for chefs

### Sprint 5 — TestFlight (Days 15–21)
1. EAS production build
2. TestFlight internal testing
3. QA matrix below
4. App Store Connect metadata + submit

---

## QA test matrix (must pass before TestFlight)

| # | Flow | Role | Pass criteria |
|---|------|------|---------------|
| 1 | Email sign up / login | Customer | Lands on intro/browse |
| 2 | Google OAuth | Customer | Returns to app, session active |
| 3 | Password reset email | Any | Opens app/web, can set new password |
| 4 | Set location | Customer | Saves to profile, browse works |
| 5 | Browse → dish → cart | Customer | Cart persists |
| 6 | Checkout pickup | Customer | Stripe → return → order success |
| 7 | Checkout delivery | Customer | Address verify + Stripe → success |
| 8 | Track order | Customer | Status updates visible |
| 9 | Chef login + sales dashboard | Chef | Orders list loads |
| 10 | Chef delivery zones | Chef | Static map + zone save |
| 11 | Chef dish photo upload | Chef | Image uploads to storage |
| 12 | Stripe Connect onboarding | Chef | Can return and see connected status |
| 13 | Admin dashboard | Admin | Loads without layout break |
| 14 | Calendar add (pickup) | Customer | iOS calendar sheet opens |
| 15 | iPad layout | All | No navbar overlap, usable tap targets |

---

## Apple & backend configuration checklist

### Apple Developer
- [ ] Enroll in Apple Developer Program
- [ ] Create App ID: `com.homechef.app`
- [ ] Enable Associated Domains capability (if universal links)
- [ ] Create App Store Connect listing

### Associated Domains (if using `https://yourhomechef.ca/...` links)
- [ ] Host `apple-app-site-association` on `yourhomechef.ca`
- [ ] Add `associatedDomains: ['applinks:yourhomechef.ca']` to `app.config.ts` ios section

### Supabase Auth URLs
- [ ] Site URL: `https://yourhomechef.ca` (or custom scheme for dev)
- [ ] Redirect URLs: `homechef://auth/callback`, production web callback, password reset

### Stripe
- [ ] Checkout success/cancel URLs compatible with app return strategy
- [ ] Connect onboarding return URLs for native

### Google Cloud
- [ ] Places API key restricted appropriately (iOS bundle ID if using client-side static maps)
- [ ] Edge functions (`google-places-autocomplete`, `google-geocode-forward`) deployed

---

## Using Claude Fable effectively on this plan

Fable speeds up **implementation** of each sprint above (boilerplate, debugging, config files). It does **not** replace:

- Apple provisioning / TestFlight waiting time
- Physical device testing of Stripe + OAuth
- App Review feedback cycles

**Best pattern:** One sprint per chat session, paste the sprint tasks + “do not change mobile navbar unless native iOS breakpoint.”

---

## Quick commands reference

```bash
# Local iOS simulator (requires Xcode on Mac)
npm run ios

# Or prebuild + run
npx expo prebuild --platform ios
npx expo run:ios

# EAS (after eas.json exists)
npx eas build --platform ios --profile development
npx eas build --platform ios --profile production
npx eas submit --platform ios
```

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-11 | Initial audit from codebase review |
