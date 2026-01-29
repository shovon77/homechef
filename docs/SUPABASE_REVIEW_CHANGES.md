# Supabase Database Changes for Review Features

## Required Changes

### 1. Add Images Column to `chef_reviews` Table

To support review images, add an `images` column to the `chef_reviews` table:

```sql
-- Option 1: JSONB array (recommended for flexibility)
ALTER TABLE chef_reviews 
ADD COLUMN images JSONB DEFAULT '[]'::jsonb;

-- Option 2: Text array (simpler but less flexible)
ALTER TABLE chef_reviews 
ADD COLUMN images TEXT[] DEFAULT ARRAY[]::TEXT[];
```

**Recommendation**: Use JSONB array to store image URLs. The application expects an array of image URLs.

### 2. Create `chef_review_replies` Table

To support chef replies to reviews, create a new table:

```sql
CREATE TABLE chef_review_replies (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES chef_reviews(id) ON DELETE CASCADE,
  chef_id BIGINT NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chef_review_replies_review_id_fkey FOREIGN KEY (review_id) REFERENCES chef_reviews(id),
  CONSTRAINT chef_review_replies_chef_id_fkey FOREIGN KEY (chef_id) REFERENCES chefs(id)
);

-- Add index for faster queries
CREATE INDEX idx_chef_review_replies_review_id ON chef_review_replies(review_id);
CREATE INDEX idx_chef_review_replies_chef_id ON chef_review_replies(chef_id);
```

### 3. Update RLS Policies

Add Row Level Security policies for the new table:

```sql
-- Drop policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Chefs can insert their own replies" ON chef_review_replies;
DROP POLICY IF EXISTS "Users can view replies to their reviews" ON chef_review_replies;
DROP POLICY IF EXISTS "Chefs can view their own replies" ON chef_review_replies;

-- Allow chefs to insert their own replies
CREATE POLICY "Chefs can insert their own replies"
  ON chef_review_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chefs 
      WHERE chefs.id = chef_review_replies.chef_id 
      AND chefs.user_id = auth.uid()
    )
  );

-- Allow users to view replies to their reviews
CREATE POLICY "Users can view replies to their reviews"
  ON chef_review_replies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chef_reviews
      WHERE chef_reviews.id = chef_review_replies.review_id
      AND chef_reviews.user_id = auth.uid()
    )
  );

-- Allow chefs to view their own replies
CREATE POLICY "Chefs can view their own replies"
  ON chef_review_replies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chefs 
      WHERE chefs.id = chef_review_replies.chef_id 
      AND chefs.user_id = auth.uid()
    )
  );
```

### 4. Update Notification Type (Already Done in Code)

The notification type `'review_reply'` has been added to the TypeScript code. Ensure your notifications table accepts this type value.

## Migration Script

Here's a complete migration script you can run:

```sql
-- Step 1: Add images column
ALTER TABLE chef_reviews 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Step 2: Create replies table
CREATE TABLE IF NOT EXISTS chef_review_replies (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES chef_reviews(id) ON DELETE CASCADE,
  chef_id BIGINT NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Add indexes
CREATE INDEX IF NOT EXISTS idx_chef_review_replies_review_id ON chef_review_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_chef_review_replies_chef_id ON chef_review_replies(chef_id);

-- Step 4: Add RLS policies
ALTER TABLE chef_review_replies ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (to allow re-running the script)
DROP POLICY IF EXISTS "Chefs can insert their own replies" ON chef_review_replies;
DROP POLICY IF EXISTS "Users can view replies to their reviews" ON chef_review_replies;
DROP POLICY IF EXISTS "Chefs can view their own replies" ON chef_review_replies;

CREATE POLICY "Chefs can insert their own replies"
  ON chef_review_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chefs 
      WHERE chefs.id = chef_review_replies.chef_id 
      AND chefs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view replies to their reviews"
  ON chef_review_replies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chef_reviews
      WHERE chef_reviews.id = chef_review_replies.review_id
      AND chef_reviews.user_id = auth.uid()
    )
  );

CREATE POLICY "Chefs can view their own replies"
  ON chef_review_replies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chefs 
      WHERE chefs.id = chef_review_replies.chef_id 
      AND chefs.user_id = auth.uid()
    )
  );
```

## Notes

- The `images` column stores an array of image URLs (as JSONB or text array)
- The `chef_review_replies` table allows chefs to reply to reviews
- Notifications are automatically created when a chef replies to a review
- The application code already handles these changes - you just need to run the migration
