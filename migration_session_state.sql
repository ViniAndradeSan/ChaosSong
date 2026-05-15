-- Run this in Supabase SQL editor

-- 1. Extend session_state with full jsonb state + log_cleared_at
alter table public.session_state
  add column if not exists state jsonb not null default '{}'::jsonb,
  add column if not exists log_cleared_at timestamptz;

-- 2. Ensure the global row exists
insert into public.session_state (id, mode, state)
values ('global', 'exploration', '{}'::jsonb)
on conflict (id) do nothing;
