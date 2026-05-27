# Glossia — Architecture Overview

## Purpose

Glossia is a language-learning web application where students read AI-generated, personalized stories and build vocabulary. Teachers create classes, assign content, and manage student progress. The app is language-agnostic (16 languages supported), with Greek as the primary target.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router v6 |
| Server state / caching | TanStack Query v5 |
| Backend / database | Supabase (PostgreSQL + Auth + RLS) |
| Icons | Lucide React |

---

## Directory Structure

```
src/
├── components/         # Reusable UI components
│   ├── layout/         # StudentLayout, TeacherLayout
│   ├── stories/        # Story reader sheets (word popup, finished reading)
│   ├── review/         # Flashcard session components
│   ├── wordbank/       # Word card components
│   └── ui/             # Generic primitives (LoadingScreen, etc.)
├── contexts/
│   └── AuthContext.tsx # Auth + profile state, shared app-wide
├── hooks/              # TanStack Query hooks (data fetching + mutations)
│   ├── useWordBank.ts
│   ├── useStories.ts
│   ├── useClasses.ts
│   └── useFollow.ts
├── lib/
│   ├── supabase.ts     # Supabase client singleton
│   ├── types.ts        # TypeScript interfaces for all DB row shapes
│   ├── constants.ts    # Shared app constants
│   ├── utils.ts        # Utility functions
│   └── ai.ts           # AI story generation helpers
├── pages/
│   ├── auth/           # LoginPage, SignupPage
│   ├── onboarding/     # OnboardingPage
│   ├── student/        # Student-facing pages
│   └── teacher/        # Teacher-facing pages
└── router/
    └── index.tsx       # Route definitions and route guards
supabase/
├── schema.sql          # Full DB schema (tables, RLS, functions, triggers)
└── migrations/         # Incremental migration files
```

---

## Authentication & Identity

Authentication is handled by **Supabase Auth**. The app maintains a two-layer identity model:

1. **`auth.users`** (Supabase-managed) — holds credentials and the session JWT. Never queried directly by the app.
2. **`user_profiles`** (app-managed) — the application identity. All foreign keys in every other table reference `user_profiles.id`, never `auth.users.id`.

The bridge between the two is `user_profiles.auth_user_id`, which maps back to `auth.users.id`.

### AuthContext (`src/contexts/AuthContext.tsx`)

A single React context wraps the Supabase auth listener and exposes:

| Value | Description |
|---|---|
| `user` | The raw Supabase `User` object (or `null`) |
| `session` | The active JWT session |
| `profile` | The `UserProfile` row from `user_profiles` |
| `loading` | True while the auth listener is initializing |
| `profileLoading` | True while the profile row is being fetched |
| `refreshProfile()` | Re-fetches the profile row on demand |

**Design note:** async work (profile fetching) is intentionally kept out of the Supabase `onAuthStateChange` callback. Doing async work inside that callback blocks Supabase's internal auth queue and causes `loading` to hang on hard reloads. Instead, profile fetching is triggered by a separate `useEffect` that watches `user?.id`.

---

## Routing & Route Guards

All routes are defined in `src/router/index.tsx` using `createBrowserRouter`.

### Guard components

| Guard | Behaviour |
|---|---|
| `RedirectIfAuth` | Wraps public routes (`/login`, `/signup`). Redirects authenticated + onboarded users to their dashboard. |
| `RequireAuth` | Redirects unauthenticated users to `/login`. |
| `RequireOnboardingComplete` | Redirects users who have not finished onboarding to `/onboarding`. |
| `StudentRoutes` | Renders `StudentLayout`; redirects non-students to the teacher dashboard. |
| `TeacherRoutes` | Renders `TeacherLayout`; redirects non-teachers to the student dashboard. |

### Route tree (summary)

```
/                          → redirect to /login
/login                     → LoginPage          (public, RedirectIfAuth)
/signup                    → SignupPage          (public, RedirectIfAuth)
/onboarding                → OnboardingPage      (RequireAuth)

/student/dashboard         → StudentDashboard
/student/stories           → StoriesPage
/student/stories/:storyId  → StoryReaderPage
/student/review/:storyId   → ReviewPage
/student/words             → WordBankPage
/student/classes           → ClassesPage
/student/classes/:classId  → StudentClassDetailPage
/student/profile           → ProfilePage

/teacher/dashboard         → TeacherDashboard
/teacher/classes           → TeacherClassesPage
/teacher/classes/:classId  → TeacherClassDetailPage
/teacher/assignments       → AssignmentsPage
/teacher/profile           → TeacherProfilePage
```

---

## Data Layer

All data access goes through **TanStack Query hooks** in `src/hooks/`. Components never call Supabase directly; they use the hooks which manage caching, invalidation, and optimistic updates.

| Hook file | Manages |
|---|---|
| `useWordBank.ts` | CRUD for `word_bank`; review/confidence logic |
| `useStories.ts` | Fetching and completing stories |
| `useClasses.ts` | Class membership, invitations |
| `useFollow.ts` | Follow/unfollow between users |

TypeScript types for all database rows are defined centrally in `src/lib/types.ts` and used across hooks, pages, and components.

---

## Account Types

The user model has exactly two account types stored in `user_profiles.account_type`:

- **`student`** — reads stories, builds a personal word bank, joins classes.
- **`teacher`** — creates classes, manages students, assigns vocabulary lists and stories.

> **Critical:** The field is named `account_type`, never `role`. The word "role" is reserved by Supabase's auth and RLS internals.

---

## Row Level Security (RLS)

Every table has RLS enabled. The helper function `get_my_profile_id()` (defined in the schema) resolves the calling user's `user_profiles.id` from the JWT, avoiding repeated subqueries across policies.

The general access model:

- Users can always read/write their own rows.
- Teachers have full control over their classes, vocab lists, and assignments.
- Students in an `accepted` class membership can read class-scoped stories, vocab lists, and assignments.
- All authenticated users can read `user_profiles` (needed for invite/search flows).

See `supabase/schema.sql` for the complete policy definitions.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| All FKs reference `user_profiles.id` | Decouples the app from Supabase auth internals; makes the data model portable |
| Word bank stores base/lemma forms only | Prevents duplicates across inflected forms (e.g., Greek verb conjugations) |
| `encountered_forms` array on `word_bank` | Records every surface form the student saw, without polluting the canonical entry |
| Streak of 5 consecutive `comfortable` reviews promotes a word to `known` | Simple, transparent mastery threshold — see `useWordBank.ts:STREAK_TO_KNOWN` |
| TanStack Query for all server state | Centralizes caching and invalidation; components stay stateless |
