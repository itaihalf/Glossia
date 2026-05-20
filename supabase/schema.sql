-- ============================================================
-- LinguaStory — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES (order respects FK dependencies)
-- ============================================================

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nickname              TEXT NOT NULL,
  email                 TEXT NOT NULL,
  account_type          TEXT NOT NULL CHECK (account_type IN ('student', 'teacher')),
  avatar_emoji          TEXT NOT NULL DEFAULT '😊',
  current_learning_language TEXT,
  language_levels       JSONB NOT NULL DEFAULT '{}',
  interests             TEXT[] NOT NULL DEFAULT '{}',
  onboarding_complete   BOOLEAN NOT NULL DEFAULT FALSE,
  goal_stories          INTEGER NOT NULL DEFAULT 1,
  goal_period           TEXT NOT NULL DEFAULT 'week' CHECK (goal_period IN ('day', 'week')),
  streak_count          INTEGER NOT NULL DEFAULT 0,
  stories_read_today    INTEGER NOT NULL DEFAULT 0,
  stories_read_this_week INTEGER NOT NULL DEFAULT 0,
  last_story_date       DATE,
  last_story_week       INTEGER,
  teaching_languages    TEXT[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Follows
CREATE TABLE IF NOT EXISTS follows (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_user_id  UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  followed_user_id  UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_user_id, followed_user_id),
  CONSTRAINT no_self_follow CHECK (follower_user_id <> followed_user_id)
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_user_id   UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  name              TEXT NOT NULL,
  language          TEXT NOT NULL,
  level             TEXT NOT NULL CHECK (level IN (
    'complete_beginner','beginner','novice','intermediate','advanced'
  )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Class Members
CREATE TABLE IF NOT EXISTS class_members (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id              UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  student_user_id       UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','rejected')),
  invited_by_teacher_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at           TIMESTAMPTZ,
  UNIQUE (class_id, student_user_id)
);

-- Word Bank
CREATE TABLE IF NOT EXISTS word_bank (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  language         TEXT NOT NULL,
  word             TEXT NOT NULL,           -- display form
  base_form        TEXT NOT NULL,           -- dictionary/lemma form
  translation      TEXT NOT NULL,
  example_sentence TEXT,
  status           TEXT NOT NULL DEFAULT 'learning' CHECK (status IN ('learning','known')),
  confidence       INTEGER NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  times_reviewed   INTEGER NOT NULL DEFAULT 0,
  successful_reviews INTEGER NOT NULL DEFAULT 0,
  encountered_forms  TEXT[] NOT NULL DEFAULT '{}',
  last_reviewed_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, language, base_form)
);

-- Vocabulary Lists (Teacher-created)
CREATE TABLE IF NOT EXISTS vocabulary_lists (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id         UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  teacher_user_id  UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  title            TEXT NOT NULL,
  language         TEXT NOT NULL,
  words            JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stories
CREATE TABLE IF NOT EXISTS stories (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  class_id             UUID REFERENCES classes(id) ON DELETE SET NULL,
  teacher_user_id      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  content              TEXT NOT NULL,
  translation          TEXT,
  language             TEXT NOT NULL,
  level                TEXT NOT NULL CHECK (level IN (
    'complete_beginner','beginner','novice','intermediate','advanced'
  )),
  length               TEXT NOT NULL CHECK (length IN ('very_short','short','medium','long')),
  interests_used       TEXT[] NOT NULL DEFAULT '{}',
  words_used_from_bank JSONB NOT NULL DEFAULT '[]',
  completed            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ
);

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id         UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  teacher_user_id  UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('vocabulary','story')),
  target_id        UUID,
  title            TEXT NOT NULL,
  due_date         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assignment Completions
CREATE TABLE IF NOT EXISTS assignment_completions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id    UUID REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
  student_user_id  UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  completed        BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at     TIMESTAMPTZ,
  UNIQUE (assignment_id, student_user_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname ON user_profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_type ON user_profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_word_bank_user_id ON word_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_word_bank_user_lang ON word_bank(user_id, language);
CREATE INDEX IF NOT EXISTS idx_word_bank_status ON word_bank(status);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_class_id ON stories(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_class_id ON class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_student_id ON class_members(student_user_id);
CREATE INDEX IF NOT EXISTS idx_class_members_status ON class_members(status);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignment_completions_student ON assignment_completions(student_user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at on any table that has the column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Returns the calling user's profile id (avoids repeating subqueries in RLS)
CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT id FROM user_profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_word_bank_updated_at
  BEFORE UPDATE ON word_bank
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows              ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_bank            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_lists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_completions ENABLE ROW LEVEL SECURITY;

-- ─── user_profiles ─────────────────────────────────────────────────────────

-- All authenticated users can read profiles (needed for search/invite)
CREATE POLICY "profiles_select_authenticated"
  ON user_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_insert_own"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "profiles_delete_own"
  ON user_profiles FOR DELETE TO authenticated
  USING (auth_user_id = auth.uid());

-- ─── word_bank ──────────────────────────────────────────────────────────────

CREATE POLICY "word_bank_own"
  ON word_bank FOR ALL TO authenticated
  USING (user_id = get_my_profile_id())
  WITH CHECK (user_id = get_my_profile_id());

-- ─── stories ────────────────────────────────────────────────────────────────

-- Users can see their own stories
CREATE POLICY "stories_select_own"
  ON stories FOR SELECT TO authenticated
  USING (user_id = get_my_profile_id());

-- Students in an accepted class can read class-assigned stories
CREATE POLICY "stories_select_class_member"
  ON stories FOR SELECT TO authenticated
  USING (
    class_id IS NOT NULL AND
    class_id IN (
      SELECT class_id FROM class_members
      WHERE student_user_id = get_my_profile_id() AND status = 'accepted'
    )
  );

-- Teachers can read stories they authored
CREATE POLICY "stories_select_teacher"
  ON stories FOR SELECT TO authenticated
  USING (teacher_user_id = get_my_profile_id());

CREATE POLICY "stories_insert_own"
  ON stories FOR INSERT TO authenticated
  WITH CHECK (user_id = get_my_profile_id());

CREATE POLICY "stories_update_own"
  ON stories FOR UPDATE TO authenticated
  USING (user_id = get_my_profile_id())
  WITH CHECK (user_id = get_my_profile_id());

CREATE POLICY "stories_delete_own"
  ON stories FOR DELETE TO authenticated
  USING (user_id = get_my_profile_id());

-- ─── follows ────────────────────────────────────────────────────────────────

CREATE POLICY "follows_select_participant"
  ON follows FOR SELECT TO authenticated
  USING (
    follower_user_id = get_my_profile_id() OR
    followed_user_id = get_my_profile_id()
  );

CREATE POLICY "follows_insert_own"
  ON follows FOR INSERT TO authenticated
  WITH CHECK (follower_user_id = get_my_profile_id());

CREATE POLICY "follows_delete_own"
  ON follows FOR DELETE TO authenticated
  USING (follower_user_id = get_my_profile_id());

-- ─── classes ────────────────────────────────────────────────────────────────

-- Teachers manage their own classes
CREATE POLICY "classes_teacher_all"
  ON classes FOR ALL TO authenticated
  USING (teacher_user_id = get_my_profile_id())
  WITH CHECK (teacher_user_id = get_my_profile_id());

-- Students can see classes they have (pending or accepted) memberships in
CREATE POLICY "classes_student_view"
  ON classes FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT class_id FROM class_members
      WHERE student_user_id = get_my_profile_id()
        AND status IN ('pending','accepted')
    )
  );

-- ─── class_members ──────────────────────────────────────────────────────────

-- Teachers manage membership for their classes
CREATE POLICY "class_members_teacher_all"
  ON class_members FOR ALL TO authenticated
  USING (
    class_id IN (SELECT id FROM classes WHERE teacher_user_id = get_my_profile_id())
  )
  WITH CHECK (
    class_id IN (SELECT id FROM classes WHERE teacher_user_id = get_my_profile_id())
  );

-- Students can view their own memberships
CREATE POLICY "class_members_student_select"
  ON class_members FOR SELECT TO authenticated
  USING (student_user_id = get_my_profile_id());

-- Students can accept/reject their invitation
CREATE POLICY "class_members_student_update"
  ON class_members FOR UPDATE TO authenticated
  USING (student_user_id = get_my_profile_id())
  WITH CHECK (
    student_user_id = get_my_profile_id() AND
    status IN ('accepted','rejected')
  );

-- Students can leave a class (delete their membership)
CREATE POLICY "class_members_student_delete"
  ON class_members FOR DELETE TO authenticated
  USING (student_user_id = get_my_profile_id());

-- ─── vocabulary_lists ────────────────────────────────────────────────────────

-- Teachers manage their vocab lists
CREATE POLICY "vocab_lists_teacher_all"
  ON vocabulary_lists FOR ALL TO authenticated
  USING (teacher_user_id = get_my_profile_id())
  WITH CHECK (teacher_user_id = get_my_profile_id());

-- Students in an accepted class can read vocab lists
CREATE POLICY "vocab_lists_student_select"
  ON vocabulary_lists FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT class_id FROM class_members
      WHERE student_user_id = get_my_profile_id() AND status = 'accepted'
    )
  );

-- ─── assignments ────────────────────────────────────────────────────────────

-- Teachers manage their assignments
CREATE POLICY "assignments_teacher_all"
  ON assignments FOR ALL TO authenticated
  USING (teacher_user_id = get_my_profile_id())
  WITH CHECK (teacher_user_id = get_my_profile_id());

-- Students can see assignments for their accepted classes
CREATE POLICY "assignments_student_select"
  ON assignments FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT class_id FROM class_members
      WHERE student_user_id = get_my_profile_id() AND status = 'accepted'
    )
  );

-- ─── assignment_completions ──────────────────────────────────────────────────

-- Teachers can see completions for their assignments
CREATE POLICY "completions_teacher_select"
  ON assignment_completions FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_user_id = get_my_profile_id()
    )
  );

-- Students manage their own completions
CREATE POLICY "completions_student_all"
  ON assignment_completions FOR ALL TO authenticated
  USING (student_user_id = get_my_profile_id())
  WITH CHECK (student_user_id = get_my_profile_id());
