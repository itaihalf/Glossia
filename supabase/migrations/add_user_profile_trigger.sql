-- Migration: auto-create user_profiles row on auth.users INSERT
-- Run in: Supabase Dashboard > SQL Editor

-- ============================================================
-- FUNCTION: handle_new_user
-- Inserts a minimal user_profiles row immediately after a new
-- auth user is created. The trigger runs SECURITY DEFINER so it
-- bypasses RLS (which would otherwise block an insert from the
-- auth schema context). Onboarding upserts the full profile
-- later — the ON CONFLICT clause makes this idempotent.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    auth_user_id,
    nickname,
    email,
    account_type,
    onboarding_complete
  )
  VALUES (
    NEW.id,
    -- Prefer a nickname passed as signup metadata; fall back to email prefix.
    -- Onboarding will overwrite this with the user's real chosen nickname.
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'nickname', ''),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.email, ''),
    -- Prefer account_type from signup metadata; default to 'student'.
    -- Onboarding will correct this via upsert (onConflict: 'auth_user_id').
    CASE
      WHEN NEW.raw_user_meta_data->>'account_type' IN ('student', 'teacher')
      THEN NEW.raw_user_meta_data->>'account_type'
      ELSE 'student'
    END,
    FALSE
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGER: on_auth_user_created
-- Fires after every INSERT on auth.users (new sign-up or
-- admin-created user). CREATE OR REPLACE is not supported for
-- triggers, so we drop-and-recreate idempotently.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
