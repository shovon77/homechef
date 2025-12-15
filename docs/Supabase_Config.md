# Supabase Authentication Configuration Guide

If you are experiencing issues where logging in with Google redirects you to a Replit URL instead of your Vercel app (e.g., `...riker.replit.dev`), you need to update your Supabase Authentication settings.

## The Issue
Supabase has a security feature called **Redirect URLs**. It only allows authentication redirects to URLs that are explicitly whitelisted. If the app sends a redirect URL (like your Vercel URL) that is NOT in the whitelist, Supabase rejects it and falls back to the default **Site URL** (which is currently set to your Replit instance).

## How to Fix

1.  **Log in to Supabase**: Go to [supabase.com](https://supabase.com) and open your project dashboard.
2.  **Go to Auth Settings**:
    *   Click on the **Authentication** icon in the left sidebar.
    *   Select **URL Configuration** from the submenu.
3.  **Add Redirect URL**:
    *   Scroll down to the **Redirect URLs** section.
    *   Click the **Add URL** button.
    *   Enter your Vercel deployment URL followed by `/**` to allow all paths.
    *   **Example**: `https://your-project-name.vercel.app/**`
    *   *(Make sure to use `https`)*
4.  **Save Changes**: Click **Save**.

## Verification
After saving, try logging in again on your Vercel app. Supabase should now accept the Vercel redirect URL and correctly return you to your app instead of the Replit page.

## Optional: Update Site URL
You can also update the **Site URL** field in the same section to your production Vercel URL (`https://your-project-name.vercel.app`). This ensures that any fallback redirects also go to your live app.
