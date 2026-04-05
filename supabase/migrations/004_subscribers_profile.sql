-- Add profile columns to subscribers
alter table subscribers
  add column if not exists first_name  text,
  add column if not exists last_name   text,
  add column if not exists avatar_type text,
  add column if not exists country     text;
