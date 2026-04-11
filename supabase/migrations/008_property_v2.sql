-- Migration 008 — Property V2: snapshots, actions, alerts + new columns on properties

-- New columns on properties
alter table properties
  add column if not exists current_score      integer,
  add column if not exists recommended_price  numeric,
  add column if not exists last_snapshot_at   timestamptz;

-- ── property_snapshots ─────────────────────────────────────────────────────

create table if not exists property_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references properties(id)   on delete cascade,
  user_id            uuid not null references auth.users(id)   on delete cascade,
  price_median       numeric,
  price_p25          numeric,
  price_p75          numeric,
  variance_pct       integer,
  score              integer,
  est_monthly_revenue numeric,
  recommended_price  numeric,
  listings_count     integer,
  created_at         timestamptz default now()
);
alter table property_snapshots enable row level security;
create policy "users_own_snapshots" on property_snapshots
  for all using (auth.uid() = user_id);

-- ── property_actions ───────────────────────────────────────────────────────

create table if not exists property_actions (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id)  on delete cascade,
  user_id      uuid not null references auth.users(id)  on delete cascade,
  action_type  text not null,   -- 'price_change' | 'note' | 'snapshot'
  old_value    numeric,
  new_value    numeric,
  note         text,
  created_at   timestamptz default now()
);
alter table property_actions enable row level security;
create policy "users_own_actions" on property_actions
  for all using (auth.uid() = user_id);

-- ── property_alerts ────────────────────────────────────────────────────────

create table if not exists property_alerts (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id)  on delete cascade,
  user_id      uuid not null references auth.users(id)  on delete cascade,
  alert_type   text not null,   -- 'new_competitor' | 'price_opportunity' | 'high_season' | 'market_movement'
  title        text,
  message      text,
  read         boolean default false,
  created_at   timestamptz default now()
);
alter table property_alerts enable row level security;
create policy "users_own_alerts" on property_alerts
  for all using (auth.uid() = user_id);
