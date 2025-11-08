# HomeChef

Expo + Expo Router + React Native (web + native) + Supabase app.

Check out the [Expo Router documentation](https://docs.expo.dev/routing/introduction/) for more information.

## Development

### Route Conflicts

Expo Router cannot handle routes where both `app/<route>.tsx` and `app/<route>/index.tsx` exist. This creates a conflict.

**Check for route conflicts:**
```bash
npm run lint:routes
```

This script will exit with a non-zero code if conflicts are found.

**Pre-commit hook (recommended):**
Add to your `.git/hooks/pre-commit`:
```bash
#!/bin/sh
npm run lint:routes
```

Or use a tool like `husky` to run it automatically.

**CI/CD:**
Add to your CI pipeline:
```yaml
- name: Check route conflicts
  run: npm run lint:routes
```

**Route structure:**
- ✅ Use folder-based routes: `app/<route>/index.tsx`
- ❌ Avoid single-file routes when a folder exists: `app/<route>.tsx`
- ✅ Use clean paths in links: `/profile`, `/admin/profile`, `/chef/profile`
