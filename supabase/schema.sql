create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  contract_hours_week numeric(5,2) not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  work_date date not null,
  hours numeric(5,2) not null check (hours >= 0 and hours <= 24),
  status text not null default 'draft' check (status in ('draft', 'final')),
  shift_type text check (shift_type in ('day', 'evening', 'night', 'kto')),
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

create table if not exists public.vacations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  name text,
  kind text not null check (kind in ('region', 'personal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year smallint not null,
  regular_hours numeric(6,2) not null default 0,
  balance_hours numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year)
);

create table if not exists public.leave_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  leave_date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  leave_type text not null check (leave_type in ('regular', 'balance')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leave_entries_user_date_idx
  on public.leave_entries (user_id, leave_date);

create table if not exists public.year_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year smallint not null,
  carryover_hours numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year)
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

create trigger set_work_entries_updated_at
before update on public.work_entries
for each row execute function public.set_updated_at();

create trigger set_closures_updated_at
before update on public.closures
for each row execute function public.set_updated_at();

create trigger set_vacations_updated_at
before update on public.vacations
for each row execute function public.set_updated_at();

create trigger set_leave_balances_updated_at
before update on public.leave_balances
for each row execute function public.set_updated_at();

create trigger set_leave_entries_updated_at
before update on public.leave_entries
for each row execute function public.set_updated_at();

create trigger set_year_settings_updated_at
before update on public.year_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.work_entries enable row level security;
alter table public.closures enable row level security;
alter table public.vacations enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_entries enable row level security;
alter table public.year_settings enable row level security;

create policy "Profiles are self managed"
  on public.profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

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

create policy "Vacations are user owned"
  on public.vacations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Leave balances are user owned"
  on public.leave_balances
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Leave entries are user owned"
  on public.leave_entries
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Year settings are user owned"
  on public.year_settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
