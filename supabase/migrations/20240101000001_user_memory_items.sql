-- user_memory_items: derived user traits / memory for RAG context
create table if not exists public.user_memory_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  memory_type   text not null,
  content       text not null,
  confidence    numeric(4,3) not null default 1.0 check (confidence >= 0 and confidence <= 1),
  source_events uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- index for per-user time-ordered queries
create index if not exists user_memory_items_user_created
  on public.user_memory_items (user_id, created_at desc);

-- unique constraint so upsert can target (user_id, memory_type)
create unique index if not exists user_memory_items_user_type
  on public.user_memory_items (user_id, memory_type);

-- RLS
alter table public.user_memory_items enable row level security;

create policy "Users can manage own memory items"
  on public.user_memory_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
