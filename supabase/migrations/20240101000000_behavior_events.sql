-- behavior_events: canonical log of all user/system behavioral events
create table if not exists public.behavior_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  event_type  text not null,
  event_data  jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  dedup_key   text unique,
  source      text
);

-- index for per-user time-ordered queries
create index if not exists behavior_events_user_created
  on public.behavior_events (user_id, created_at desc);

-- index for dedup lookups
create index if not exists behavior_events_user_dedup
  on public.behavior_events (user_id, dedup_key);

-- RLS: each user can only read/insert their own rows
alter table public.behavior_events enable row level security;

create policy "Users can insert own behavior events"
  on public.behavior_events for insert
  with check (auth.uid() = user_id);

create policy "Users can read own behavior events"
  on public.behavior_events for select
  using (auth.uid() = user_id);
