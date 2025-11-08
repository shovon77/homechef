# Admin Access Configuration

## Two Ways to Grant Admin Access

### (a) Environment Variable (Convenience / Dev Only)
Add emails to `EXPO_PUBLIC_ADMIN_EMAILS` in your `.env` file:

```env
EXPO_PUBLIC_ADMIN_EMAILS=you@domain.com,other@domain.com
```

**Note:** This is case-insensitive and checked on the client side. Use this for development convenience only.

### (b) Database Flag (Production-Safe)
Set `profiles.is_admin = true` in the Supabase database:

```sql
UPDATE profiles SET is_admin = true WHERE id = 'user-uuid-here';
```

**Note:** This is the recommended approach for production. The `is_admin` flag is checked server-side and should be enforced by RLS policies.

## How It Works

The `useAdmin()` hook checks both:
1. `profiles.is_admin` boolean flag (from database)
2. Email allow-list from `EXPO_PUBLIC_ADMIN_EMAILS` (from environment)

If either condition is true, the user is considered an admin.

## Security Notes

- **Client-side checks are for UX only** - Always enforce admin access with RLS policies on the server side
- The `lib/adminActions.ts` functions include client-side guards that show alerts, but these should not be relied upon for security
- All admin mutations (toggle chef active, update order status, etc.) should be protected by Supabase RLS policies

## RLS Policy Example

```sql
-- Example: Only admins can update chef active status
CREATE POLICY "Only admins can update chefs"
ON chefs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);
```

