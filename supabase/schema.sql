create table if not exists public.health_contexts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null,
  prediction jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  log jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

alter table public.health_contexts enable row level security;
alter table public.daily_logs enable row level security;

create policy "Users can read their health context"
on public.health_contexts for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their health context"
on public.health_contexts for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their health context"
on public.health_contexts for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read their daily logs"
on public.daily_logs for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their daily logs"
on public.daily_logs for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their daily logs"
on public.daily_logs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.health_contexts to authenticated;
grant select, insert, update on public.daily_logs to authenticated;
