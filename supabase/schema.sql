create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  contract_hours_week numeric(5,2) not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.base_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  planned_hours numeric(5,2) not null check (planned_hours >= 0 and planned_hours <= 24),
  start_time time,
  end_time time,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  work_date date not null,
  hours numeric(5,2) not null check (hours >= 0 and hours <= 24),
  status text not null default 'draft' check (status in ('draft', 'final')),
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_entries_user_date_idx
  on public.work_entries (user_id, work_date);

create table if not exists public.closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  can_work boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_base_schedule_updated_at
before update on public.base_schedule
for each row execute function public.set_updated_at();

create trigger set_work_entries_updated_at
before update on public.work_entries
for each row execute function public.set_updated_at();

create trigger set_closures_updated_at
before update on public.closures
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.base_schedule enable row level security;
alter table public.work_entries enable row level security;
alter table public.closures enable row level security;

create policy "Profiles are self managed"
  on public.profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Base schedule is user owned"
  on public.base_schedule
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Work entries are user owned"
  on public.work_entries
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Closures are user owned"
  on public.closures
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
