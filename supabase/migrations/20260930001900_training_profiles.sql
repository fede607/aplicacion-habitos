-- =============================================================================
-- Perfil de entrenamiento (plan personalizado Pro). Datos de salud: sólo los
-- ve y edita su dueño (RLS); nunca se comparten con el grupo.
-- =============================================================================
create table public.training_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birth_year smallint not null check (birth_year between 1920 and 2020),
  sex text not null check (sex in ('male', 'female')),
  height_cm smallint not null check (height_cm between 120 and 230),
  weight_kg numeric(5, 1) not null check (weight_kg between 30 and 250),
  goal text not null check (goal in ('fat_loss', 'muscle', 'strength', 'endurance', 'health')),
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  training_type text not null check (training_type in ('gym', 'home_dumbbells', 'bodyweight', 'running', 'mixed')),
  days_per_week smallint not null check (days_per_week between 2 and 6),
  session_minutes smallint not null check (session_minutes in (30, 45, 60, 75, 90)),
  limitations text[] not null default '{}' check (limitations <@ array['knee', 'lower_back', 'shoulder']::text[]),
  updated_at timestamptz not null default now()
);

alter table public.training_profiles enable row level security;

create policy "training_profiles: select own" on public.training_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "training_profiles: insert own" on public.training_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "training_profiles: update own" on public.training_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "training_profiles: delete own" on public.training_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.training_profiles from anon;
grant select, insert, update, delete on public.training_profiles to authenticated;
