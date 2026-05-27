-- Migration: add streak_count to word_bank
-- Run in: Supabase Dashboard > SQL Editor

ALTER TABLE word_bank
  ADD COLUMN IF NOT EXISTS streak_count INTEGER NOT NULL DEFAULT 0;
