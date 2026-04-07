create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  address text,
  zone text,
  property_type text,
  bedrooms integer,
  current_price_night numeric,
  acquisition_price numeric,
  lease_type text,
  lease_duration integer,
  latitude numeric,
  longitude numeric,
  weekly_alerts boolean default true,
  last_recommendations jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table properties enable row level security;
create policy "users_own_properties" on properties
  for all using (auth.uid() = user_id);
