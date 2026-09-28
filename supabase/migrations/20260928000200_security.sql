-- =============================================================================
-- Winter Arc — seguridad: helpers, validaciones de escritura, RLS y grants.
--
-- Principios:
--   * Deny by default: RLS activado en TODAS las tablas públicas.
--   * El cliente nunca decide user_id / group_id de forma efectiva: los
--     triggers los fijan o los validan contra auth.uid().
--   * Las operaciones con reglas complejas (crear grupo, unirse, roles,
--     invitaciones) sólo existen como funciones SECURITY DEFINER que
--     comprueban permisos explícitamente.
--   * Los helpers viven en el esquema `private`, que PostgREST no expone.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de autorización (SECURITY DEFINER para evitar recursión de RLS)
-- -----------------------------------------------------------------------------
create or replace function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members m
    join public.groups g on g.id = m.group_id
    where m.group_id = p_group_id
      and m.user_id = (select auth.uid())
      and g.deleted_at is null
  );
$$;

create or replace function private.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members m
    join public.groups g on g.id = m.group_id
    where m.group_id = p_group_id
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
      and g.deleted_at is null
  );
$$;

-- ¿Comparte el usuario actual algún grupo activo con p_user_id?
create or replace function private.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members other on other.group_id = me.group_id
    join public.groups g on g.id = me.group_id
    where me.user_id = (select auth.uid())
      and other.user_id = p_user_id
      and g.deleted_at is null
  );
$$;

-- ¿Puede el usuario actual ver los registros de hábitos de p_owner en p_group?
create or replace function private.can_view_member_habits(p_owner uuid, p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner = (select auth.uid())
    or (
      private.is_group_member(p_group_id)
      and exists (
        select 1 from public.group_members m
        where m.group_id = p_group_id and m.user_id = p_owner
      )
      and coalesce(
        (select s.share_habits from public.user_settings s where s.user_id = p_owner),
        false
      )
    );
$$;

-- Fecha "hoy" en la zona horaria del usuario.
create or replace function private.user_today(p_user_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = p_user_id),
    'UTC'
  ))::date;
$$;

-- Ventana (en días) durante la que un registro sigue siendo editable.
create or replace function private.log_edit_window_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 7 $$;

-- Rate limiting de ventana fija. Lanza WA429 si se supera el máximo.
create or replace function private.check_rate_limit(p_key text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket timestamptz := date_bin(p_window, now(), timestamptz '2000-01-01');
  v_hits integer;
begin
  delete from private.rate_limits where key = p_key and bucket_start < v_bucket;

  insert into private.rate_limits as r (key, bucket_start, hits)
  values (p_key, v_bucket, 1)
  on conflict (key, bucket_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  if v_hits > p_max then
    raise exception 'rate limited' using errcode = 'WA429';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Validación de escrituras de datos personales
-- -----------------------------------------------------------------------------
create or replace function private.assert_editable_date(p_date date, p_user_id uuid, p_back_days integer)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := private.user_today(p_user_id);
begin
  -- +1 día de margen por desfases de zona horaria entre dispositivo y perfil.
  if p_date > v_today + 1 or p_date < v_today - p_back_days then
    raise exception 'date not editable' using errcode = 'WA422';
  end if;
end;
$$;

create or replace function private.validate_habit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit record;
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.habit_id <> old.habit_id or new.log_date <> old.log_date then
      raise exception 'immutable columns' using errcode = 'WA422';
    end if;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  select h.group_id, h.is_active, h.archived_at into v_habit
  from public.habits h where h.id = new.habit_id;

  if not found or v_habit.archived_at is not null or not v_habit.is_active then
    raise exception 'habit not available' using errcode = 'WA422';
  end if;

  -- group_id siempre se deriva del hábito: el cliente no puede falsearlo.
  new.group_id := v_habit.group_id;

  perform private.assert_editable_date(new.log_date, new.user_id, private.log_edit_window_days());
  return new;
end;
$$;

create trigger habit_logs_validate before insert or update on public.habit_logs
  for each row execute function private.validate_habit_log();

create or replace function private.validate_daily_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.entry_date <> old.entry_date) then
    raise exception 'immutable columns' using errcode = 'WA422';
  end if;
  perform private.assert_editable_date(new.entry_date, new.user_id, private.log_edit_window_days());
  return new;
end;
$$;

create trigger daily_entries_validate before insert or update on public.daily_entries
  for each row execute function private.validate_daily_entry();

create or replace function private.validate_workout()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id then
      raise exception 'immutable columns' using errcode = 'WA422';
    end if;
  else
    -- Anti-spam: como máximo 10 entrenamientos por día y usuario.
    if (select count(*) from public.workouts w
        where w.user_id = new.user_id and w.workout_date = new.workout_date) >= 10 then
      raise exception 'too many workouts' using errcode = 'WA429';
    end if;
  end if;
  perform private.assert_editable_date(new.workout_date, new.user_id, 60);
  return new;
end;
$$;

create trigger workouts_validate before insert or update on public.workouts
  for each row execute function private.validate_workout();
create trigger workouts_updated_at before update on public.workouts
  for each row execute function private.set_updated_at();

-- user_settings.active_group_id sólo puede apuntar a un grupo del usuario.
create or replace function private.validate_user_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  if new.active_group_id is not null
     and new.active_group_id is distinct from old.active_group_id
     and not private.is_group_member(new.active_group_id) then
    raise exception 'not a member' using errcode = 'WA403';
  end if;
  return new;
end;
$$;

create trigger user_settings_validate before update on public.user_settings
  for each row execute function private.validate_user_settings();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invitations enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.daily_entries enable row level security;
alter table public.workouts enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table private.rate_limits enable row level security;

-- profiles: yo + miembros de mis grupos pueden leer; sólo yo edito el mío.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_group_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_settings: estrictamente privado.
create policy user_settings_select on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_settings_update on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- groups: los miembros leen; los admins editan. Crear/borrar => RPC.
create policy groups_select on public.groups for select to authenticated
  using (deleted_at is null and private.is_group_member(id));
create policy groups_update on public.groups for update to authenticated
  using (private.is_group_admin(id))
  with check (private.is_group_admin(id) and deleted_at is null);

-- group_members: lectura para miembros del grupo. Escrituras sólo vía RPC.
create policy group_members_select on public.group_members for select to authenticated
  using (private.is_group_member(group_id));

-- group_invitations: sólo admins. Escrituras sólo vía RPC.
create policy group_invitations_select on public.group_invitations for select to authenticated
  using (private.is_group_admin(group_id));

-- habits: miembros leen; admins crean/editan (borrado = archivado).
create policy habits_select on public.habits for select to authenticated
  using (private.is_group_member(group_id));
create policy habits_insert on public.habits for insert to authenticated
  with check (private.is_group_admin(group_id));
create policy habits_update on public.habits for update to authenticated
  using (private.is_group_admin(group_id))
  with check (private.is_group_admin(group_id));

-- habit_logs: el dueño gestiona los suyos; el grupo lee si el dueño comparte.
create policy habit_logs_select on public.habit_logs for select to authenticated
  using (private.can_view_member_habits(user_id, group_id));
create policy habit_logs_insert on public.habit_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_group_member(group_id));
create policy habit_logs_update on public.habit_logs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_group_member(group_id));
create policy habit_logs_delete on public.habit_logs for delete to authenticated
  using (
    user_id = (select auth.uid())
    and log_date >= private.user_today(user_id) - private.log_edit_window_days()
  );

-- daily_entries: notas personales, sólo el dueño.
create policy daily_entries_select on public.daily_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy daily_entries_insert on public.daily_entries for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy daily_entries_update on public.daily_entries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- workouts: sólo el dueño (el grupo ve agregados vía RPC si se comparten).
create policy workouts_select on public.workouts for select to authenticated
  using (user_id = (select auth.uid()));
create policy workouts_insert on public.workouts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy workouts_update on public.workouts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy workouts_delete on public.workouts for delete to authenticated
  using (user_id = (select auth.uid()));

-- achievements: catálogo público para usuarios autenticados.
create policy achievements_select on public.achievements for select to authenticated
  using (true);
create policy user_achievements_select on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Grants: mínimo privilegio. anon no toca ninguna tabla.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated, public;
revoke all on schema private from public;

grant usage on schema private to authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.user_settings to authenticated;
grant select, update on public.groups to authenticated;
grant select on public.group_members to authenticated;
grant select on public.group_invitations to authenticated;
grant select, insert, update on public.habits to authenticated;
grant select, insert, update, delete on public.habit_logs to authenticated;
grant select, insert, update on public.daily_entries to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
grant select on public.achievements to authenticated;
grant select on public.user_achievements to authenticated;

-- Columnas que el cliente NO puede escribir directamente.
revoke update on public.groups from authenticated;
grant update (name, description, rules, start_date, end_date, streak_threshold, comparison_enabled, max_members)
  on public.groups to authenticated;
revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_emoji, avatar_color, timezone) on public.profiles to authenticated;
revoke update on public.user_settings from authenticated;
grant update (share_habits, share_workouts, show_in_comparison, reminder_enabled, reminder_time, active_group_id)
  on public.user_settings to authenticated;
revoke insert, update on public.habits from authenticated;
grant insert (group_id, name, description, icon, category, color, frequency, weekdays, weekly_target, is_optional, goal, sort_order, is_active, starts_on)
  on public.habits to authenticated;
grant update (name, description, icon, category, color, frequency, weekdays, weekly_target, is_optional, goal, sort_order, is_active, starts_on, archived_at)
  on public.habits to authenticated;
revoke insert, update on public.habit_logs from authenticated;
grant insert (habit_id, user_id, log_date, status) on public.habit_logs to authenticated;
grant update (status) on public.habit_logs to authenticated;

-- Funciones: nada ejecutable por defecto; se concede explícitamente en 0300.
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema private revoke execute on functions from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
