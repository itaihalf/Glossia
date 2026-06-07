-- Migration: stories as assignments
-- - vocabulary_lists.class_id becomes nullable (global teacher-owned lists)
-- - stories gains due_date and is_open for assignment tracking
-- Run in: Supabase Dashboard > SQL Editor

-- ─── vocabulary_lists: make class_id nullable ────────────────────────────────

-- Drop the existing FK so we can redefine it with ON DELETE SET NULL.
-- (ON DELETE CASCADE would delete the list when its class is removed, which is
--  wrong once a list can exist independent of any class.)
ALTER TABLE vocabulary_lists
  DROP CONSTRAINT IF EXISTS vocabulary_lists_class_id_fkey;

ALTER TABLE vocabulary_lists
  ALTER COLUMN class_id DROP NOT NULL;

ALTER TABLE vocabulary_lists
  ADD CONSTRAINT vocabulary_lists_class_id_fkey
    FOREIGN KEY (class_id)
    REFERENCES classes(id)
    ON DELETE SET NULL;

-- NOTE: The existing RLS policy "vocab_lists_student_select" filters by
-- class_id membership and will NOT expose global (class_id IS NULL) lists to
-- students. A future migration or policy update will be needed once the UI
-- surface for global lists is decided.

-- ─── stories: add assignment columns ─────────────────────────────────────────

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS due_date  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_open   BOOLEAN NOT NULL DEFAULT TRUE;

-- Index so teachers can efficiently query open/upcoming assigned stories.
CREATE INDEX IF NOT EXISTS idx_stories_is_open   ON stories(is_open);
CREATE INDEX IF NOT EXISTS idx_stories_due_date  ON stories(due_date);
