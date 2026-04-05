-- Align subscribers table
alter table subscribers
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists stripe_session_id text unique,
  add column if not exists active boolean default true;

-- Align reports table
alter table reports
  add column if not exists user_id uuid references auth.users(id);
