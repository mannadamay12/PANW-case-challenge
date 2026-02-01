-- Migration: Add title and entry_type columns to journals table
-- These columns support the UI redesign with AI-generated titles and entry type modes

-- Add title column (nullable, AI-generated or user-provided)
ALTER TABLE journals ADD COLUMN title TEXT;

-- Add entry_type column (morning, evening, gratitude, reflection)
ALTER TABLE journals ADD COLUMN entry_type TEXT DEFAULT 'reflection';
