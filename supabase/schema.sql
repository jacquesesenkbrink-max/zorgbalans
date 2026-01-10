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

create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('gedrag', 'oorzaak', 'aanpak', 'effect', 'interactie')),
  template_type text not null default 'standard' check (template_type in ('standard', 'interaction')),
  text text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists report_templates_unique_idx
  on public.report_templates (owner_id, category, template_type, text);

create table if not exists public.report_chain_options (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('gedrag', 'oorzaak', 'aanpak', 'effect')),
  text text not null,
  next_ids text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_report_templates_updated_at
before update on public.report_templates
for each row execute function public.set_updated_at();

create trigger set_report_chain_options_updated_at
before update on public.report_chain_options
for each row execute function public.set_updated_at();

alter table public.report_templates enable row level security;
alter table public.report_chain_options enable row level security;

create policy "Report templates are private"
  on public.report_templates
  for all
  using (auth.uid() = '2a9957ed-02db-4d30-8b14-19e4d0f89e75')
  with check (auth.uid() = '2a9957ed-02db-4d30-8b14-19e4d0f89e75');

create policy "Report chain options are private"
  on public.report_chain_options
  for all
  using (auth.uid() = '2a9957ed-02db-4d30-8b14-19e4d0f89e75')
  with check (auth.uid() = '2a9957ed-02db-4d30-8b14-19e4d0f89e75');

insert into public.report_templates (owner_id, category, template_type, text, sort_order)
values
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'standard', 'Ik zie dat je je stem verhoogt en wegloopt uit de ruimte.', 10),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'standard', 'Je weigert de opdracht en gaat in discussie.', 20),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'standard', 'Je bent stil, teruggetrokken en maakt weinig contact.', 30),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'standard', 'Je loopt onrustig rond en verlaat meerdere keren de ruimte.', 40),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'standard', 'Je zoekt de grens op en test de afspraken.', 50),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'standard', 'De aanleiding lijkt een verandering in planning of verwachting.', 10),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'standard', 'De drukte of harde geluiden in de omgeving lijken je te prikkelen.', 20),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'standard', 'Onzekerheid over de taak lijkt spanning te geven.', 30),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'standard', 'De afwijzing van een verzoek lijkt frustratie op te roepen.', 40),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'standard', 'Vermoeidheid lijkt mee te spelen in je reactie.', 50),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'standard', 'Ik heb je rustig aangesproken, grenzen benoemd en je een keuze geboden.', 10),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'standard', 'Ik heb je een time-out aangeboden en prikkels verminderd.', 20),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'standard', 'Ik heb structuur gegeven met korte, duidelijke stappen.', 30),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'standard', 'Ik heb gecontroleerd of je de afspraak begreep en deze herhaald.', 40),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'standard', 'We hebben samen afgesproken wat nodig was om verder te kunnen.', 50),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'standard', 'Je kalmeerde en pakte de taak weer op.', 10),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'standard', 'Je bleef geagiteerd, maar de situatie is gestabiliseerd.', 20),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'standard', 'Je trok je terug maar bleef aanspreekbaar.', 30),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'standard', 'Je accepteerde de afspraak en de sfeer verbeterde.', 40),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'standard', 'Je had tijd nodig, daarna was weer contact mogelijk.', 50),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'interactie', 'interaction', 'Ik zie dat je reageert op {other}.', 10),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'interactie', 'interaction', 'Er ontstaat spanning in het contact met {other}.', 20),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'interactie', 'interaction', 'Je zoekt contact met {other} en stemt gedrag daarop af.', 30),
  ('2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'interactie', 'interaction', 'Ik zie kort contact tussen jou en {other}.', 40)
on conflict on constraint report_templates_unique_idx do nothing;

insert into public.report_chain_options (id, owner_id, category, text, next_ids, sort_order)
values
  ('gedrag-verhoogt-stem', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'Ik zie dat je je stem verhoogt en wegloopt uit de ruimte.', array['oorzaak-planning', 'oorzaak-prikkels', 'oorzaak-frustratie'], 10),
  ('gedrag-weigert-opdracht', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'Je weigert de opdracht en gaat in discussie.', array['oorzaak-onzeker', 'oorzaak-frustratie', 'oorzaak-verandering'], 20),
  ('gedrag-teruggetrokken', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'Je bent stil, teruggetrokken en maakt weinig contact.', array['oorzaak-onzeker', 'oorzaak-vermoeid', 'oorzaak-prikkels'], 30),
  ('gedrag-onrustig', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'Je loopt onrustig rond en verlaat meerdere keren de ruimte.', array['oorzaak-prikkels', 'oorzaak-verandering', 'oorzaak-onzeker'], 40),
  ('gedrag-grens', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'gedrag', 'Je zoekt de grens op en test de afspraken.', array['oorzaak-frustratie', 'oorzaak-verandering', 'oorzaak-onzeker'], 50),
  ('oorzaak-planning', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'De aanleiding lijkt een verandering in planning of verwachting.', array['aanpak-structuur', 'aanpak-grenzen', 'aanpak-samen-afspraak'], 10),
  ('oorzaak-prikkels', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'De drukte of harde geluiden in de omgeving lijken je te prikkelen.', array['aanpak-timeout', 'aanpak-structuur', 'aanpak-grenzen'], 20),
  ('oorzaak-onzeker', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'Onzekerheid over de taak lijkt spanning te geven.', array['aanpak-structuur', 'aanpak-herhalen', 'aanpak-samen-afspraak'], 30),
  ('oorzaak-frustratie', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'De afwijzing van een verzoek lijkt frustratie op te roepen.', array['aanpak-grenzen', 'aanpak-keuze', 'aanpak-timeout'], 40),
  ('oorzaak-vermoeid', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'Vermoeidheid lijkt mee te spelen in je reactie.', array['aanpak-timeout', 'aanpak-structuur', 'aanpak-samen-afspraak'], 50),
  ('oorzaak-verandering', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'oorzaak', 'Een verandering in de situatie lijkt je te ontregelen.', array['aanpak-structuur', 'aanpak-grenzen', 'aanpak-samen-afspraak'], 60),
  ('aanpak-grenzen', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'Ik heb je rustig aangesproken, grenzen benoemd en je een keuze geboden.', array['effect-kalmeert', 'effect-stabiliseert', 'effect-sfeer'], 10),
  ('aanpak-timeout', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'Ik heb je een time-out aangeboden en prikkels verminderd.', array['effect-kalmeert', 'effect-terugtrekken', 'effect-stabiliseert'], 20),
  ('aanpak-structuur', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'Ik heb structuur gegeven met korte, duidelijke stappen.', array['effect-kalmeert', 'effect-sfeer', 'effect-contact'], 30),
  ('aanpak-herhalen', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'Ik heb gecontroleerd of je de afspraak begreep en deze herhaald.', array['effect-sfeer', 'effect-kalmeert', 'effect-contact'], 40),
  ('aanpak-samen-afspraak', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'We hebben samen afgesproken wat nodig was om verder te kunnen.', array['effect-sfeer', 'effect-contact', 'effect-stabiliseert'], 50),
  ('aanpak-keuze', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'aanpak', 'Ik heb je een keuze gegeven zodat je regie kon behouden.', array['effect-kalmeert', 'effect-sfeer', 'effect-contact'], 60),
  ('effect-kalmeert', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'Je kalmeerde en pakte de taak weer op.', array[]::text[], 10),
  ('effect-stabiliseert', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'Je bleef geagiteerd, maar de situatie is gestabiliseerd.', array[]::text[], 20),
  ('effect-terugtrekken', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'Je trok je terug maar bleef aanspreekbaar.', array[]::text[], 30),
  ('effect-sfeer', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'Je accepteerde de afspraak en de sfeer verbeterde.', array[]::text[], 40),
  ('effect-contact', '2a9957ed-02db-4d30-8b14-19e4d0f89e75', 'effect', 'Je had tijd nodig, daarna was weer contact mogelijk.', array[]::text[], 50)
on conflict (id) do update set
  owner_id = excluded.owner_id,
  category = excluded.category,
  text = excluded.text,
  next_ids = excluded.next_ids,
  sort_order = excluded.sort_order;
