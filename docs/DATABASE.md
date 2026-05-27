# LinguaStory — Database Reference

The database runs on **Supabase (PostgreSQL)**. Row Level Security (RLS) is enabled on every table. The full DDL, triggers, and policies are in `supabase/schema.sql`.

---

## Identity Model

All application foreign keys reference **`user_profiles.id`**, not `auth.users.id`. The bridge column is `user_profiles.auth_user_id`.

```
auth.users (Supabase-managed)
    └── auth_user_id (1:1)
            └── user_profiles.id  ←  FK anchor for the entire schema
```

---

## Tables

### `user_profiles`

The central identity record for every user in the app.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | App-level identity; used as FK everywhere |
| `auth_user_id` | UUID UNIQUE | Maps back to `auth.users.id` |
| `nickname` | TEXT | Display name |
| `email` | TEXT | |
| `account_type` | TEXT | `'student'` or `'teacher'` — **never** use `role` |
| `avatar_emoji` | TEXT | Single emoji, default `'😊'` |
| `current_learning_language` | TEXT | BCP-47 language code (e.g. `'el'`, `'es'`) |
| `language_levels` | JSONB | `{ "el": "intermediate", "es": "beginner" }` |
| `interests` | TEXT[] | Used to personalise AI story generation |
| `onboarding_complete` | BOOLEAN | Gate for the onboarding flow |
| `goal_stories` | INTEGER | Target number of stories |
| `goal_period` | TEXT | `'day'` or `'week'` |
| `streak_count` | INTEGER | Consecutive goal-period completions |
| `stories_read_today` | INTEGER | Reset daily |
| `stories_read_this_week` | INTEGER | Reset weekly |
| `last_story_date` | DATE | Used to detect day rollovers |
| `last_story_week` | INTEGER | ISO week number; used to detect week rollovers |
| `teaching_languages` | TEXT[] | Languages a teacher instructs (teachers only) |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto-managed; `updated_at` via trigger |

**RLS:** All authenticated users can SELECT. Users can only INSERT/UPDATE/DELETE their own row.

---

### `word_bank`

A student's personal vocabulary list. One row per unique word (by `base_form`) per language.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → `user_profiles.id` | Owner |
| `language` | TEXT | BCP-47 language code |
| `word` | TEXT | Display form (always set to `base_form` on insert) |
| `base_form` | TEXT | Dictionary / lemma form — the deduplication key |
| `translation` | TEXT | In the student's native language |
| `example_sentence` | TEXT | Optional; sourced from the story context |
| `status` | TEXT | `'learning'` or `'known'` |
| `confidence` | INTEGER | 0–100 |
| `times_reviewed` | INTEGER | Total review attempts |
| `successful_reviews` | INTEGER | Attempts answered `'comfortable'` |
| `streak_count` | INTEGER | Consecutive comfortable answers |
| `encountered_forms` | TEXT[] | All inflected forms seen across stories |
| `last_reviewed_at` | TIMESTAMPTZ | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Unique constraint:** `(user_id, language, base_form)` — prevents duplicate entries for the same word.

**Mastery rule:** When `streak_count` reaches `5` (constant `STREAK_TO_KNOWN` in `useWordBank.ts`), the word's `status` is automatically promoted from `'learning'` to `'known'` during the next review mutation.

**RLS:** Full access to own rows only (via `get_my_profile_id()`).

---

### `stories`

AI-generated stories. A story always belongs to a student (`user_id`). It may additionally be linked to a class if it was assigned by a teacher.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → `user_profiles.id` | The student who owns the story |
| `class_id` | UUID FK → `classes.id` (nullable) | Set when assigned through a class |
| `teacher_user_id` | UUID FK → `user_profiles.id` (nullable) | Set when teacher assigned the story |
| `title` | TEXT | |
| `content` | TEXT | Full story text in the target language |
| `translation` | TEXT | Optional full translation |
| `language` | TEXT | BCP-47 language code |
| `level` | TEXT | `complete_beginner` / `beginner` / `novice` / `intermediate` / `advanced` |
| `length` | TEXT | `very_short` / `short` / `medium` / `long` |
| `interests_used` | TEXT[] | Interests from `user_profiles.interests` used during generation |
| `words_used_from_bank` | JSONB | Word bank entries woven into the story |
| `completed` | BOOLEAN | Set to `true` when the student finishes reading |
| `created_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | Set when `completed` transitions to `true` |

**RLS:**
- Students see their own stories.
- Students in an `accepted` class membership see class-assigned stories.
- Teachers see stories they authored.

---

### `classes`

A teacher's class. Groups students under a shared language and level.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `teacher_user_id` | UUID FK → `user_profiles.id` | Owner |
| `name` | TEXT | |
| `language` | TEXT | BCP-47 language code |
| `level` | TEXT | Same level enum as `stories` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**RLS:** Teacher has full control. Students can SELECT classes they have a membership row for (any status).

---

### `class_members`

Join table between a class and its students. Membership goes through an invitation lifecycle.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `class_id` | UUID FK → `classes.id` | |
| `student_user_id` | UUID FK → `user_profiles.id` | |
| `status` | TEXT | `'pending'` → `'accepted'` or `'rejected'` |
| `invited_by_teacher_id` | UUID FK → `user_profiles.id` (nullable) | |
| `created_at` | TIMESTAMPTZ | |
| `accepted_at` | TIMESTAMPTZ | Set when status moves to `accepted` |

**Unique constraint:** `(class_id, student_user_id)`.

**RLS:** Teacher manages all memberships in their class. Student can SELECT their own rows, UPDATE status to `accepted`/`rejected`, and DELETE (leave class).

---

### `vocabulary_lists`

Teacher-curated word lists, attached to a class. The `words` column holds an array of word objects.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `class_id` | UUID FK → `classes.id` | |
| `teacher_user_id` | UUID FK → `user_profiles.id` | |
| `title` | TEXT | |
| `language` | TEXT | |
| `words` | JSONB | Array of `{ word, base_form, translation, part_of_speech?, example_sentence? }` |
| `created_at` | TIMESTAMPTZ | |

**RLS:** Teacher has full control. Students in an `accepted` membership can SELECT.

---

### `assignments`

An assignment links a class to either a vocabulary list or a story. The `target_id` field is a generic UUID pointer to the assigned resource.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `class_id` | UUID FK → `classes.id` | |
| `teacher_user_id` | UUID FK → `user_profiles.id` | |
| `type` | TEXT | `'vocabulary'` or `'story'` |
| `target_id` | UUID (nullable) | FK to `vocabulary_lists.id` or `stories.id` depending on `type` |
| `title` | TEXT | |
| `due_date` | TIMESTAMPTZ (nullable) | |
| `created_at` | TIMESTAMPTZ | |

**RLS:** Teacher manages. Students in an `accepted` class can SELECT.

---

### `assignment_completions`

Tracks per-student completion of each assignment.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `assignment_id` | UUID FK → `assignments.id` | |
| `student_user_id` | UUID FK → `user_profiles.id` | |
| `completed` | BOOLEAN | |
| `completed_at` | TIMESTAMPTZ | |

**Unique constraint:** `(assignment_id, student_user_id)`.

**RLS:** Teachers can SELECT completions for their assignments. Students have full control over their own rows.

---

### `follows`

Social follow relationships between users (student ↔ student or any pair).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `follower_user_id` | UUID FK → `user_profiles.id` | |
| `followed_user_id` | UUID FK → `user_profiles.id` | |
| `created_at` | TIMESTAMPTZ | |

**Constraints:** `UNIQUE(follower_user_id, followed_user_id)` and `CHECK (follower_user_id <> followed_user_id)`.

**RLS:** A user can see follows where they are either participant. Only the follower can INSERT or DELETE.

---

## Relationships Diagram

```
user_profiles
    │
    ├──< follows (follower / followed)
    │
    ├──< word_bank  (user_id)
    │
    ├──< stories  (user_id)
    │       └── class_id (optional) ──┐
    │                                  │
    ├──< classes (teacher_user_id)  <──┘
    │       │
    │       ├──< class_members (class_id / student_user_id)
    │       │
    │       ├──< vocabulary_lists (class_id)
    │       │
    │       └──< assignments (class_id)
    │               │
    │               └──< assignment_completions (assignment_id / student_user_id)
```

---

## Database Functions & Triggers

### `get_my_profile_id()` — `SECURITY DEFINER`

Resolves the calling user's `user_profiles.id` from the active JWT. Used in every RLS policy to avoid repeating the same subquery.

```sql
SELECT id FROM user_profiles WHERE auth_user_id = auth.uid() LIMIT 1;
```

### `update_updated_at_column()` trigger

Fires `BEFORE UPDATE` on `user_profiles`, `classes`, and `word_bank` to keep `updated_at` current automatically.

---

## Indexes

| Index | Table | Columns |
|---|---|---|
| `idx_user_profiles_auth_user_id` | `user_profiles` | `auth_user_id` |
| `idx_user_profiles_email` | `user_profiles` | `email` |
| `idx_user_profiles_account_type` | `user_profiles` | `account_type` |
| `idx_word_bank_user_id` | `word_bank` | `user_id` |
| `idx_word_bank_user_lang` | `word_bank` | `(user_id, language)` |
| `idx_word_bank_status` | `word_bank` | `status` |
| `idx_stories_user_id` | `stories` | `user_id` |
| `idx_stories_class_id` | `stories` | `class_id` |
| `idx_class_members_class_id` | `class_members` | `class_id` |
| `idx_class_members_student_id` | `class_members` | `student_user_id` |
| `idx_class_members_status` | `class_members` | `status` |
| `idx_follows_follower` | `follows` | `follower_user_id` |
| `idx_follows_followed` | `follows` | `followed_user_id` |
| `idx_assignments_class_id` | `assignments` | `class_id` |
| `idx_assignment_completions_student` | `assignment_completions` | `student_user_id` |
