-- RLS Fix for session_state table
-- Run this in your Supabase SQL Editor to fix the "violates row-level security policy" error

-- Option 1: Disable RLS on session_state (recommended for this table)
ALTER TABLE public.session_state DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS, create policies for anon users:
-- Enable RLS first
ALTER TABLE public.session_state ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Allow anon select session_state" ON public.session_state;
DROP POLICY IF EXISTS "Allow anon insert session_state" ON public.session_state;
DROP POLICY IF EXISTS "Allow anon update session_state" ON public.session_state;
DROP POLICY IF EXISTS "Allow anon upsert session_state" ON public.session_state;

-- Create new policies for anonymous users
CREATE POLICY "Allow anon select session_state"
  ON public.session_state
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert session_state"
  ON public.session_state
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update session_state"
  ON public.session_state
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
