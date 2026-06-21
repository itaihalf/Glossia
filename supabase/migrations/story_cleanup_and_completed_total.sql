-- Migration: lightweight stories table — auto-delete old read stories + keep a
-- lifetime "stories completed" counter that survives those deletions.
-- Run in: Supabase Dashboard > SQL Editor
--
-- Two pieces work together:
--   1. user_profiles.stories_completed_total — an ever-growing counter that is
--      incremented the moment a story is marked completed. Because it lives on
--      the profile (not derived from the stories table), it stays accurate even
--      after the underlying story rows are deleted by the cleanup job below.
--   2. A daily pg_cron job that deletes stories read more than 7 days ago,
--      keeping the table small without ever touching the counter.

-- ─── 1. Lifetime completed-stories counter ───────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stories_completed_total INTEGER NOT NULL DEFAULT 0;

-- Backfill the baseline from any already-completed stories so existing users
-- don't start at zero. (Historical class-story reads were never recorded as
-- completed story rows, so they can't be recovered — only owned completions.)
UPDATE user_profiles up
SET stories_completed_total = (
  SELECT COUNT(*) FROM stories s
  WHERE s.user_id = up.id AND s.completed = TRUE
);

-- Increment the owner's lifetime counter exactly when a story transitions to
-- completed. SECURITY DEFINER so it can update user_profiles regardless of RLS.
-- The transition guard (OLD.completed -> TRUE) ensures we count each story once,
-- and a later DELETE never fires this trigger, so the counter is never reduced.
CREATE OR REPLACE FUNCTION increment_stories_completed_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_profiles
    SET stories_completed_total = stories_completed_total + 1
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

-- ─── 2. Auto-cleanup of old read stories ──────────────────────────────────────

-- Deletes stories that were marked completed more than 7 days ago. Returns the
-- number of rows removed (handy when invoking manually). SECURITY DEFINER so the
-- scheduled job can delete across all users' rows regardless of RLS.
CREATE OR REPLACE FUNCTION cleanup_old_read_stories()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM stories
  WHERE completed = TRUE
    AND completed_at IS NOT NULL
    AND completed_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- pg_cron drives the schedule. On Supabase this extension may also be enabled
-- via Dashboard > Database > Extensions; this statement is a no-op if already on.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Re-running this migration must not stack duplicate jobs: drop any prior one
-- before (re)scheduling.
SELECT cron.unschedule('cleanup-old-read-stories')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-read-stories');

-- Run daily at 03:00 UTC.
SELECT cron.schedule(
  'cleanup-old-read-stories',
  '0 3 * * *',
  $$ SELECT cleanup_old_read_stories(); $$
);
