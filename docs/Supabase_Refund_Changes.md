# Supabase Changes for Refund Functionality

## Overview
This document outlines the database changes needed to properly support the refund functionality in the admin dashboard.

## Required Changes

### 1. Add 'refunded' Status to order_issues Table

**Location:** Supabase SQL Editor

**Action:** Run the migration file: `migrations/add_refunded_status.sql`

This migration:
- Removes the existing CHECK constraint on the `status` column
- Adds a new CHECK constraint that includes 'refunded' as a valid status value
- Updates the column comment to reflect the new status

**SQL to Run:**
```sql
-- Drop the existing CHECK constraint
ALTER TABLE public.order_issues
DROP CONSTRAINT IF EXISTS order_issues_status_check;

-- Add the new CHECK constraint with 'refunded' status
ALTER TABLE public.order_issues
ADD CONSTRAINT order_issues_status_check 
CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed', 'refunded'));

-- Update the comment to reflect the new status
COMMENT ON COLUMN public.order_issues.status IS 'Status of the issue: pending, reviewing, resolved, dismissed, refunded';
```

### 2. Order Status Update (Already Fixed in Code)

The `cancel-payment` Supabase Edge Function has been updated to:
- Set order status to `'cancelled'` (instead of `'rejected'`) when a refund is processed
- This ensures that refunded orders are properly marked as cancelled

**No manual database changes needed** - this is handled by the updated Edge Function code.

## Verification

After running the migration, verify the changes:

1. **Check order_issues table constraint:**
   ```sql
   SELECT conname, pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE conrelid = 'public.order_issues'::regclass 
   AND conname = 'order_issues_status_check';
   ```

2. **Test refund flow:**
   - Go to Admin Dashboard → Issues tab
   - Click "Refund" on an issue
   - Confirm the refund
   - Verify:
     - Issue status updates to "refunded"
     - Order status updates to "cancelled"
     - Action button is greyed out

## Summary

- ✅ **Migration file created:** `migrations/add_refunded_status.sql`
- ✅ **Edge Function updated:** `supabase/functions/cancel-payment/index.ts` now sets order status to 'cancelled'
- ✅ **Application code updated:** Admin dashboard now handles 'refunded' status properly

## Next Steps

1. Run the SQL migration in Supabase SQL Editor
2. Deploy the updated `cancel-payment` Edge Function (if using Supabase CLI: `supabase functions deploy cancel-payment`)
3. Test the refund functionality in the admin dashboard
