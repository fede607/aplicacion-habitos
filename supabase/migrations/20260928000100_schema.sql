-- =============================================================================
-- Winter Arc — esquema base
-- Tablas, tipos, constraints e índices. La seguridad (RLS, grants) vive en
-- 20260928000200_security.sql y la lógica de negocio en 20260928000300_functions.sql.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Esquema no expuesto por PostgREST: helpers de seguridad y tablas internas.
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.group_role as enum ('admin', 'member');
create type public.habit_category as enum ('physical', 'mental', 'productivity', 'health', 'other');
create type public.habit_frequency as enum ('daily', 'weekdays', 'weekly_target');
create type public.habit_log_status as enum ('done', 'missed', 'skipped');
create type public.workout_type as enum ('gym', 'boxing', 'cardio', 'mobility', 'other');

-- -----------------------------------------------------------------------------
-- Utilidades genéricas
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create or replace function private.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- -----------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_emoji text,
  avatar_color text not null default '#38bdf8',
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_len check (char_length(btrim(display_name)) between 1 and 40),
  constraint profiles_avatar_emoji_len check (avatar_emoji is null or char_length(avatar_emoji) between 1 and 8),
  constraint profiles_avatar_color_hex check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint profiles_timezone_len check (char_length(timezone) between 1 and 64)
);
create unique index profiles_username_key on public.profiles (username);

create or replace function private.validate_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := btrim(new.display_name);
  if not private.is_valid_timezone(new.timezone) then
    raise exception 'invalid timezone' using errcode = 'WA422';
  end if;
  return new;
end;
$$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function private.validate_profile();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Preferencias de usuario (privacidad, recordatorios)
-- -----------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  share_habits boolean not null default true,
  share_workouts boolean not null default true,
  show_in_comparison boolean not null default true,
  reminder_enabled boolean not null default false,
  reminder_time time not null default '20:30',
  active_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Grupos
-- -----------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  rules text not null default '',
  start_date date not null default current_date,
  end_date date not null default (current_date + 90),
  streak_threshold smallint not null default 80,
  comparison_enabled boolean not null default false,
  max_members integer not null default 200,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint groups_name_len check (char_length(btrim(name)) between 2 and 60),
  constraint groups_description_len check (char_length(description) <= 500),
  constraint groups_rules_len check (char_length(rules) <= 2000),
  constraint groups_dates check (end_date > start_date and end_date - start_date <= 366),
  constraint groups_streak_threshold check (streak_threshold between 1 and 100),
  constraint groups_max_members check (max_members between 2 and 1000)
);

alter table public.user_settings
  add constraint user_settings_active_group_fk
  foreign key (active_group_id) references public.groups (id) on delete set null;

create or replace function private.protect_group_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_by := old.created_by;
  new.name := btrim(new.name);
  return new;
end;
$$;

create trigger groups_protect before update on public.groups
  for each row execute function private.protect_group_columns();
create trigger groups_updated_at before update on public.groups
  for each row execute function private.set_updated_at();

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);
create index group_members_group_role_idx on public.group_members (group_id, role);

-- -----------------------------------------------------------------------------
-- Invitaciones
-- -----------------------------------------------------------------------------
create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  code text not null,
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  max_uses integer,
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint group_invitations_code_format check (code ~ '^[A-HJ-NP-Z2-9]{12}$'),
  constraint group_invitations_max_uses check (max_uses is null or max_uses between 1 and 1000),
  constraint group_invitations_use_count check (use_count >= 0)
);
create unique index group_invitations_code_key on public.group_invitations (code);
create index group_invitations_group_idx on public.group_invitations (group_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Hábitos (configurables por los admins del grupo)
-- -----------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  description text not null default '',
  icon text not null default 'check',
  category public.habit_category not null default 'other',
  color text not null default '#38bdf8',
  frequency public.habit_frequency not null default 'daily',
  weekdays smallint[] not null default '{}',
  weekly_target smallint,
  is_optional boolean not null default false,
  goal text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_on date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint habits_name_len check (char_length(btrim(name)) between 1 and 60),
  constraint habits_description_len check (char_length(description) <= 300),
  constraint habits_goal_len check (char_length(goal) <= 100),
  constraint habits_icon_format check (icon ~ '^[a-z0-9-]{1,40}$'),
  constraint habits_color_hex check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint habits_sort_order check (sort_order between 0 and 10000),
  constraint habits_weekdays_valid check (
    weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(weekdays) <= 7
  ),
  constraint habits_frequency_config check (
    (frequency = 'daily' and weekly_target is null)
    or (frequency = 'weekdays' and cardinality(weekdays) between 1 and 7 and weekly_target is null)
    or (frequency = 'weekly_target' and weekly_target between 1 and 7)
  )
);
create index habits_group_order_idx on public.habits (group_id, sort_order) where archived_at is null;

create or replace function private.protect_habit_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.group_id := old.group_id;
    new.created_by := old.created_by;
  else
    new.created_by := auth.uid();
  end if;
  new.name := btrim(new.name);
  if new.frequency <> 'weekdays' then
    new.weekdays := '{}';
  else
    select coalesce(array_agg(distinct d order by d), '{}') into new.weekdays from unnest(new.weekdays) d;
  end if;
  return new;
end;
$$;

create trigger habits_protect before insert or update on public.habits
  for each row execute function private.protect_habit_columns();
create trigger habits_updated_at before update on public.habits
  for each row execute function private.set_updated_at();

-- Límite de hábitos por grupo (anti-abuso).
create or replace function private.limit_habits_per_group()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.habits where group_id = new.group_id and archived_at is null) >= 40 then
    raise exception 'too many habits' using errcode = 'WA422';
  end if;
  return new;
end;
$$;

create trigger habits_limit before insert on public.habits
  for each row execute function private.limit_habits_per_group();

-- -----------------------------------------------------------------------------
-- Registros diarios de hábitos
-- -----------------------------------------------------------------------------
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  log_date date not null,
  status public.habit_log_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_logs_unique unique (user_id, habit_id, log_date)
);
create index habit_logs_group_date_idx on public.habit_logs (group_id, log_date);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);
create index habit_logs_habit_idx on public.habit_logs (habit_id);

-- -----------------------------------------------------------------------------
-- Notas diarias (privadas)
-- -----------------------------------------------------------------------------
create table public.daily_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_date date not null,
  did_today text not null default '',
  improve_tomorrow text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_date),
  constraint daily_entries_did_len check (char_length(did_today) <= 2000),
  constraint daily_entries_improve_len check (char_length(improve_tomorrow) <= 2000)
);

create trigger daily_entries_updated_at before update on public.daily_entries
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Entrenamientos
-- -----------------------------------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workout_date date not null,
  type public.workout_type not null,
  duration_min smallint not null,
  intensity smallint,
  feeling smallint,
  exercises text not null default '',
  notes text not null default '',
  next_goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_duration check (duration_min between 1 and 600),
  constraint workouts_intensity check (intensity is null or intensity between 1 and 10),
  constraint workouts_feeling check (feeling is null or feeling between 1 and 10),
  constraint workouts_exercises_len check (char_length(exercises) <= 2000),
  constraint workouts_notes_len check (char_length(notes) <= 2000),
  constraint workouts_next_goal_len check (char_length(next_goal) <= 500)
);
create index workouts_user_date_idx on public.workouts (user_id, workout_date desc, created_at desc);

-- -----------------------------------------------------------------------------
-- Logros
-- -----------------------------------------------------------------------------
create table public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  emoji text not null,
  metric text not null,
  threshold integer not null,
  xp integer not null default 0,
  sort_order integer not null default 0,
  constraint achievements_code_format check (code ~ '^[a-z0-9_]{2,40}$'),
  constraint achievements_metric check (
    metric in ('active_days', 'best_streak', 'workouts', 'workout_minutes', 'habit_done_total', 'productivity_done', 'notes_written')
  ),
  constraint achievements_threshold check (threshold > 0),
  constraint achievements_xp check (xp >= 0)
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_code text not null references public.achievements (code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

-- -----------------------------------------------------------------------------
-- Rate limiting (interno, no expuesto por la API)
-- -----------------------------------------------------------------------------
create table private.rate_limits (
  key text not null,
  bucket_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, bucket_start)
);
create index rate_limits_bucket_idx on private.rate_limits (bucket_start);
