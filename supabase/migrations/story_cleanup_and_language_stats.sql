-- Migration: per-language lifetime counter + dual-rule story cleanup.
-- Run in: Supabase Dashboard > SQL Editor
--
-- This is a single, idempotent, fresh script that brings the database to its
-- current desired state. It supersedes the cleanup function from
-- story_cleanup_and_completed_total.sql and folds in the per-language counter.
-- Safe to run on a DB that already applied that earlier script — every statement
-- uses IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS.
--
-- What it sets up:
--   1. user_profiles.stories_completed_total       — lifetime counter (column only;
--      see note — its backfill is intentionally NOT repeated here).
--   2. user_profiles.stories_completed_by_language — JSONB { lang: count } breakdown
--      that survives the cleanup below, plus a one-time backfill.
--   3. A trigger that bumps BOTH counters when a story is completed.
--   4. A dual-rule daily cleanup:
--        • Regular user stories  → delete 7 days after completed_at.
--        • Teacher/class stories with a due_date → delete 7 days after due_date,
--          regardless of whether/when the student completed them.

-- ─── 1. Lifetime counter columns ──────────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stories_completed_total INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stories_completed_by_language JSONB NOT NULL DEFAULT '{}'::jsonb;

-- NOTE: stories_completed_total is deliberately NOT re-backfilled here. The
-- earlier migration already seeded it, and it has been live-incrementing since.
-- Re-running `SET stories_completed_total = COUNT(completed stories)` would CLOBBER
-- it down to only the stories that still survive cleanup — destroying the whole
-- point of a deletion-proof counter.

-- ─── 2. Trigger: bump total AND the story's language on completion ─────────────

-- Transition guard (in the trigger below) ensures each story is counted once and
-- never on DELETE. jsonb_set(..., create_missing => true) adds the language key on
-- first completion; COALESCE makes the arithmetic start from 0 for null/absent.
CREATE OR REPLACE FUNCTION increment_stories_completed_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_profiles
    SET stories_completed_total = stories_completed_total + 1,
        stories_completed_by_language = jsonb_set(
          COALESCE(stories_completed_by_language, '{}'::jsonb),
          ARRAY[NEW.language],
          to_jsonb(
            COALESCE((stories_completed_by_language ->> NEW.language)::int, 0) + 1
          ),
          true
        )
    WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stories_increment_completed_total ON stories;
CREATE TRIGGER trg_stories_increment_completed_total
  AFTER UPDATE OF completed ON stories
  FOR EACH ROW
  WHEN (NEW.completed = TRUE AND OLD.completed IS DISTINCT FROM TRUE)
  EXECUTE FUNCTION increment_stories_completed_total();

-- ─── 3. One-time backfill of the per-language breakdown ───────────────────────

-- Build a { language: count } map per user from completed story rows that still
-- survive in the table, and write it onto profiles whose breakdown is still empty.
-- The `= '{}'` guard makes this safe to re-run: it never clobbers counts already
-- accumulated by the trigger. (As with the total, class-story reads were never
-- stored as completed rows, so they can't be recovered — the total may therefore
-- exceed the sum of the per-language buckets, which is expected.)
UPDATE user_profiles up
SET stories_completed_by_language = agg.counts
FROM (
  SELECT user_id, jsonb_object_agg(language, cnt) AS counts
  FROM (
    SELECT user_id, language, COUNT(*) AS cnt
    FROM stories
    WHERE completed = TRUE
    GROUP BY user_id, language
  ) per_lang
  GROUP BY user_id
) agg
WHERE up.id = agg.user_id
  AND up.stories_completed_by_language = '{}'::jsonb;

-- ─── 4. Dual-rule cleanup of old stories ──────────────────────────────────────

-- Deletes stories under two independent rules. Returns the number of rows removed
-- (handy when invoking manually). SECURITY DEFINER so the scheduled job can delete
-- across all users' rows regardless of RLS.
CREATE OR REPLACE FUNCTION cleanup_old_read_stories()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM stories
  WHERE
    -- Teacher/class stories assigned with a due date: removed exactly one week
    -- after the due date, whether or not the student ever completed them.
    (due_date IS NOT NULL AND due_date < NOW() - INTERVAL '7 days')
    OR
    -- Regular user-generated stories (no due date): removed one week after the
    -- student marked them completed.
    (due_date IS NULL
       AND completed = TRUE
       AND completed_at IS NOT NULL
       AND completed_at < NOW() - INTERVAL '7 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ─── 5. Schedule the daily cleanup ────────────────────────────────────────────

-- pg_cron drives the schedule. On Supabase this extension may also be enabled via
-- Dashboard > Database > Extensions; this statement is a no-op if already on.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Re-running must not stack duplicate jobs: drop any prior one before rescheduling.
SELECT cron.unschedule('cleanup-old-read-stories')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-read-stories');

-- Run daily at 03:00 UTC.
SELECT cron.schedule(
  'cleanup-old-read-stories',
  '0 3 * * *',
  $$ SELECT cleanup_old_read_stories(); $$
);
