-- =============================================================================
-- Winter Arc — lógica de negocio (RPC) y datos de referencia.
-- Convención de errores (SQLSTATE):
--   WA403 sin permiso · WA404 no encontrado / inválido · WA409 conflicto
--   WA422 validación · WA429 demasiadas peticiones
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Alta de usuario: crea perfil + preferencias a partir de los metadatos.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(regexp_replace(coalesce(v_meta ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'));
  v_display text := left(btrim(coalesce(v_meta ->> 'display_name', '')), 40);
  v_tz text := coalesce(v_meta ->> 'timezone', 'Europe/Madrid');
begin
  if v_username !~ '^[a-z0-9_]{3,24}$'
     or exists (select 1 from public.profiles where username = v_username) then
    v_username := 'user_' || encode(extensions.gen_random_bytes(5), 'hex');
  end if;
  if v_display = '' then
    v_display := v_username;
  end if;
  if not private.is_valid_timezone(v_tz) then
    v_tz := 'Europe/Madrid';
  end if;

  insert into public.profiles (id, username, display_name, timezone)
  values (new.id, v_username, v_display, v_tz);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ¿Está libre un nombre de usuario? (usado en el registro)
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_username ~ '^[a-z0-9_]{3,24}$'
    and not exists (
      select 1 from public.profiles
      where username = p_username and id is distinct from (select auth.uid())
    );
$$;

-- -----------------------------------------------------------------------------
-- Invitaciones
-- -----------------------------------------------------------------------------
-- 12 caracteres de un alfabeto de 32 símbolos (sin 0/O/1/I) = 60 bits de entropía.
-- 256 % 32 = 0, así que el módulo no introduce sesgo.
create or replace function private.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(12);
  v_code text := '';
begin
  for i in 0..11 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

create or replace function private.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

create or replace function public.create_invitation(
  p_group_id uuid,
  p_expires_in_hours integer default 168,
  p_max_uses integer default null
)
returns public.group_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.group_invitations;
begin
  if not private.is_group_admin(p_group_id) then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  if p_expires_in_hours is not null and (p_expires_in_hours < 1 or p_expires_in_hours > 24 * 90) then
    raise exception 'invalid expiration' using errcode = 'WA422';
  end if;
  if p_max_uses is not null and (p_max_uses < 1 or p_max_uses > 1000) then
    raise exception 'invalid max uses' using errcode = 'WA422';
  end if;
  perform private.check_rate_limit('invite_create:' || auth.uid()::text, 30, interval '1 hour');

  insert into public.group_invitations (group_id, code, created_by, expires_at, max_uses)
  values (
    p_group_id,
    private.generate_invite_code(),
    auth.uid(),
    case when p_expires_in_hours is null then null else now() + make_interval(hours => p_expires_in_hours) end,
    p_max_uses
  )
  returning * into v_inv;
  return v_inv;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.group_invitations where id = p_invitation_id;
  if v_group is null or not private.is_group_admin(v_group) then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  update public.group_invitations set revoked_at = coalesce(revoked_at, now()) where id = p_invitation_id;
end;
$$;

-- Estado de una invitación sin revelar nada más que lo necesario.
create or replace function private.invitation_state(p_inv public.group_invitations)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
  v_count integer;
begin
  if p_inv.id is null then return 'invalid'; end if;
  select * into v_group from public.groups where id = p_inv.group_id;
  if v_group.id is null or v_group.deleted_at is not null then return 'invalid'; end if;
  if p_inv.revoked_at is not null then return 'revoked'; end if;
  if p_inv.expires_at is not null and p_inv.expires_at <= now() then return 'expired'; end if;
  if p_inv.max_uses is not null and p_inv.use_count >= p_inv.max_uses then return 'exhausted'; end if;
  select count(*) into v_count from public.group_members where group_id = p_inv.group_id;
  if v_count >= v_group.max_members then return 'full'; end if;
  return 'valid';
end;
$$;

create or replace function public.get_invitation_preview(p_code text)
returns table (status text, group_name text, group_description text, member_count integer, already_member boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.group_invitations;
  v_state text;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  perform private.check_rate_limit('invite_preview:' || auth.uid()::text, 30, interval '10 minutes');

  select * into v_inv from public.group_invitations where code = private.normalize_invite_code(p_code);
  v_state := private.invitation_state(v_inv);

  -- Sólo se revela el nombre del grupo si la invitación es usable o ya eres miembro.
  if v_state = 'invalid' or (
    v_state <> 'valid'
    and not exists (
      select 1 from public.group_members m where m.group_id = v_inv.group_id and m.user_id = auth.uid()
    )
  ) then
    return query select v_state, null::text, null::text, null::integer, false;
    return;
  end if;

  return query
    select v_state, g.name, g.description,
      (select count(*)::integer from public.group_members m where m.group_id = g.id),
      exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid())
    from public.groups g where g.id = v_inv.group_id;
end;
$$;

-- Unirse con código. Los códigos inválidos NO lanzan excepción: devolver un
-- estado evita el rollback del contador de rate limiting (anti fuerza bruta).
create or replace function public.join_group(p_code text)
returns table (status text, group_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.group_invitations;
  v_state text;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  -- Limita la fuerza bruta de códigos: 10 intentos / 10 min por usuario.
  perform private.check_rate_limit('invite_join:' || auth.uid()::text, 10, interval '10 minutes');

  select * into v_inv from public.group_invitations i
  where i.code = private.normalize_invite_code(p_code)
  for update;

  if v_inv.id is not null and exists (
    select 1 from public.group_members m where m.group_id = v_inv.group_id and m.user_id = auth.uid()
  ) then
    return query select 'already_member'::text, v_inv.group_id;
    return;
  end if;

  v_state := private.invitation_state(v_inv);
  if v_state <> 'valid' then
    return query select v_state, null::uuid;
    return;
  end if;

  insert into public.group_members (group_id, user_id, role) values (v_inv.group_id, auth.uid(), 'member');
  update public.group_invitations i set use_count = i.use_count + 1 where i.id = v_inv.id;
  update public.user_settings s set active_group_id = v_inv.group_id where s.user_id = auth.uid();
  return query select 'joined'::text, v_inv.group_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grupos
-- -----------------------------------------------------------------------------
create or replace function private.seed_default_habits(p_group_id uuid, p_starts_on date)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.habits (group_id, name, description, icon, category, color, frequency, weekdays, weekly_target, is_optional, goal, sort_order, starts_on)
  values
    (p_group_id, 'Entrenamiento', 'Sesión de fuerza o acondicionamiento.', 'dumbbell', 'physical', '#f97316', 'weekly_target', '{}', 4, false, '45-60 min', 10, p_starts_on),
    (p_group_id, 'Boxeo', 'Técnica, saco, sombra o sparring.', 'swords', 'physical', '#ef4444', 'weekdays', '{2,4,6}', null, false, '60 min', 20, p_starts_on),
    (p_group_id, 'Movilidad / estiramientos', 'Movilidad articular y estiramientos.', 'person-standing', 'physical', '#22c55e', 'daily', '{}', null, false, '10 min', 30, p_starts_on),
    (p_group_id, 'Trabajo físico / activación', 'Activación diaria: flexiones, sentadillas, paseo…', 'zap', 'physical', '#eab308', 'daily', '{}', null, false, '15 min', 40, p_starts_on),
    (p_group_id, 'Reflexión diaria', 'Escribe qué hiciste y qué mejorarás mañana.', 'notebook-pen', 'mental', '#a855f7', 'daily', '{}', null, false, '5 min', 50, p_starts_on),
    (p_group_id, 'Lectura', 'Lectura de calidad, sin pantallas si es posible.', 'book-open', 'mental', '#6366f1', 'daily', '{}', null, false, '20 páginas', 60, p_starts_on),
    (p_group_id, 'Actitud positiva', 'Centrarse en soluciones en lugar de quejas.', 'sun', 'mental', '#f59e0b', 'daily', '{}', null, false, 'Cero quejas', 70, p_starts_on),
    (p_group_id, 'Estudio', 'Bloque de estudio profundo sin distracciones.', 'graduation-cap', 'productivity', '#0ea5e9', 'weekdays', '{1,2,3,4,5}', null, false, '2 h', 80, p_starts_on),
    (p_group_id, 'Proyecto Google AdSense', 'Avance concreto en el proyecto.', 'rocket', 'productivity', '#14b8a6', 'weekly_target', '{}', 5, false, '1 bloque de trabajo', 90, p_starts_on);
$$;

create or replace function public.create_group(
  p_name text,
  p_description text default '',
  p_start_date date default null,
  p_end_date date default null,
  p_seed_defaults boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_start date := coalesce(p_start_date, private.user_today(auth.uid()));
  v_end date := coalesce(p_end_date, coalesce(p_start_date, private.user_today(auth.uid())) + 90);
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  perform private.check_rate_limit('group_create:' || v_uid::text, 5, interval '1 day');

  insert into public.groups (name, description, start_date, end_date, created_by)
  values (btrim(p_name), coalesce(p_description, ''), v_start, v_end, v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role) values (v_group_id, v_uid, 'admin');

  if p_seed_defaults then
    perform private.seed_default_habits(v_group_id, v_start);
  end if;

  insert into public.group_invitations (group_id, code, created_by, expires_at)
  values (v_group_id, private.generate_invite_code(), v_uid, now() + interval '30 days');

  update public.user_settings set active_group_id = v_group_id where user_id = v_uid;
  return v_group_id;
end;
$$;

create or replace function private.admin_count(p_group_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.group_members where group_id = p_group_id and role = 'admin';
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.group_role;
  v_members integer;
begin
  select role into v_role from public.group_members where group_id = p_group_id and user_id = v_uid;
  if v_role is null then
    raise exception 'not a member' using errcode = 'WA404';
  end if;
  select count(*) into v_members from public.group_members where group_id = p_group_id;

  if v_role = 'admin' and private.admin_count(p_group_id) = 1 and v_members > 1 then
    raise exception 'last admin' using errcode = 'WA409';
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = v_uid;
  update public.user_settings set active_group_id = null
    where user_id = v_uid and active_group_id = p_group_id;

  if v_members = 1 then
    update public.groups set deleted_at = now() where id = p_group_id;
  end if;
end;
$$;

create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.group_role;
begin
  if not private.is_group_admin(p_group_id) then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'use leave_group' using errcode = 'WA409';
  end if;
  select role into v_role from public.group_members where group_id = p_group_id and user_id = p_user_id;
  if v_role is null then
    raise exception 'not a member' using errcode = 'WA404';
  end if;
  if v_role = 'admin' then
    raise exception 'cannot remove admin' using errcode = 'WA409';
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
  update public.user_settings set active_group_id = null
    where user_id = p_user_id and active_group_id = p_group_id;
end;
$$;

create or replace function public.set_member_role(p_group_id uuid, p_user_id uuid, p_role public.group_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.group_role;
begin
  if not private.is_group_admin(p_group_id) then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  select role into v_current from public.group_members where group_id = p_group_id and user_id = p_user_id
    for update;
  if v_current is null then
    raise exception 'not a member' using errcode = 'WA404';
  end if;
  if v_current = 'admin' and p_role = 'member' and private.admin_count(p_group_id) = 1 then
    raise exception 'last admin' using errcode = 'WA409';
  end if;
  update public.group_members set role = p_role where group_id = p_group_id and user_id = p_user_id;
end;
$$;

create or replace function public.transfer_admin(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_group_admin(p_group_id) then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'same user' using errcode = 'WA409';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id) then
    raise exception 'not a member' using errcode = 'WA404';
  end if;
  update public.group_members set role = 'admin' where group_id = p_group_id and user_id = p_user_id;
  update public.group_members set role = 'member' where group_id = p_group_id and user_id = auth.uid();
end;
$$;

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_group_admin(p_group_id) then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  update public.groups set deleted_at = now() where id = p_group_id;
  update public.group_invitations set revoked_at = coalesce(revoked_at, now()) where group_id = p_group_id;
  update public.user_settings set active_group_id = null where active_group_id = p_group_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registro de hábitos (upsert que sólo toca `status`)
-- SECURITY INVOKER: se aplican RLS y triggers de validación.
-- -----------------------------------------------------------------------------
create or replace function public.set_habit_status(
  p_habit_id uuid,
  p_date date,
  p_status public.habit_log_status
)
returns public.habit_logs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.habit_logs;
begin
  if p_status is null then
    delete from public.habit_logs
    where user_id = auth.uid() and habit_id = p_habit_id and log_date = p_date;
    return null;
  end if;

  insert into public.habit_logs (user_id, habit_id, log_date, status)
  values (auth.uid(), p_habit_id, p_date, p_status)
  on conflict (user_id, habit_id, log_date) do update set status = excluded.status
  returning * into v_row;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Estadísticas diarias por miembro (SECURITY INVOKER => respeta RLS/privacidad)
--   required  = hábitos programados (diarios o por día de semana, no opcionales)
--               activos ese día, excluyendo los marcados "no aplica".
--   completed = de esos, cuántos están hechos.
--   bonus     = hechos que no eran obligatorios (objetivos semanales, opcionales).
-- -----------------------------------------------------------------------------
create or replace function public.daily_stats(
  p_group_id uuid,
  p_from date,
  p_to date,
  p_user_id uuid default null
)
returns table (user_id uuid, day date, required integer, completed integer, skipped integer, bonus integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid range' using errcode = 'WA422';
  end if;

  return query
  with members as (
    select m.user_id,
      (m.joined_at at time zone coalesce(p.timezone, 'UTC'))::date as joined_on
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    where m.group_id = p_group_id
      and (p_user_id is null or m.user_id = p_user_id)
      and private.can_view_member_habits(m.user_id, p_group_id)
  ),
  days as (
    select d::date as day from generate_series(p_from, p_to, interval '1 day') d
  ),
  hab as (
    select h.id, h.frequency, h.weekdays, h.is_optional, h.starts_on
    from public.habits h
    where h.group_id = p_group_id and h.is_active and h.archived_at is null
  ),
  sched as (
    select mm.user_id, d.day, h.id as habit_id
    from members mm
    cross join days d
    join hab h on h.starts_on <= d.day
      and not h.is_optional
      and (
        h.frequency = 'daily'
        or (h.frequency = 'weekdays' and extract(isodow from d.day)::smallint = any (h.weekdays))
      )
    where d.day >= mm.joined_on
  ),
  logs as (
    select l.user_id, l.log_date, l.habit_id, l.status
    from public.habit_logs l
    join hab h on h.id = l.habit_id
    where l.group_id = p_group_id
      and l.log_date between p_from and p_to
      and (p_user_id is null or l.user_id = p_user_id)
  ),
  req as (
    select s.user_id, s.day,
      count(*) filter (where lg.status is distinct from 'skipped') as required,
      count(*) filter (where lg.status = 'done') as completed,
      count(*) filter (where lg.status = 'skipped') as skipped
    from sched s
    left join logs lg on lg.user_id = s.user_id and lg.log_date = s.day and lg.habit_id = s.habit_id
    group by s.user_id, s.day
  ),
  extra as (
    select lg.user_id, lg.log_date as day, count(*) as bonus
    from logs lg
    where lg.status = 'done'
      and not exists (
        select 1 from sched s
        where s.user_id = lg.user_id and s.day = lg.log_date and s.habit_id = lg.habit_id
      )
    group by lg.user_id, lg.log_date
  )
  select mm.user_id, d.day,
    coalesce(r.required, 0)::integer,
    coalesce(r.completed, 0)::integer,
    coalesce(r.skipped, 0)::integer,
    coalesce(e.bonus, 0)::integer
  from members mm
  cross join days d
  left join req r on r.user_id = mm.user_id and r.day = d.day
  left join extra e on e.user_id = mm.user_id and e.day = d.day
  where d.day >= mm.joined_on
  order by mm.user_id, d.day;
end;
$$;

-- Resumen de entrenamientos del grupo (sólo de quien los comparte).
create or replace function public.group_workout_summary(p_group_id uuid, p_from date, p_to date)
returns table (user_id uuid, workouts integer, minutes integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_group_member(p_group_id) then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid range' using errcode = 'WA422';
  end if;

  return query
    select m.user_id, count(w.id)::integer, coalesce(sum(w.duration_min), 0)::integer
    from public.group_members m
    join public.user_settings s on s.user_id = m.user_id
    left join public.workouts w on w.user_id = m.user_id and w.workout_date between p_from and p_to
    where m.group_id = p_group_id
      and (s.share_workouts or m.user_id = auth.uid())
    group by m.user_id;
end;
$$;

-- Preferencias de visibilidad de los miembros (sólo lo necesario para la UI).
create or replace function public.group_member_visibility(p_group_id uuid)
returns table (user_id uuid, share_habits boolean, share_workouts boolean, show_in_comparison boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_group_member(p_group_id) then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  return query
    select m.user_id, s.share_habits, s.share_workouts, s.show_in_comparison
    from public.group_members m
    join public.user_settings s on s.user_id = m.user_id
    where m.group_id = p_group_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Logros: se calculan en servidor a partir de datos reales (no falsificables
-- desde el cliente: user_achievements no tiene permisos de escritura).
-- -----------------------------------------------------------------------------
create or replace function private.best_streak_for(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_best integer := 0;
  v_group record;
  v_run integer;
begin
  for v_group in
    select g.id, g.streak_threshold,
      greatest(g.start_date, (m.joined_at at time zone p.timezone)::date) as from_day
    from public.group_members m
    join public.groups g on g.id = m.group_id and g.deleted_at is null
    join public.profiles p on p.id = m.user_id
    where m.user_id = p_user_id
  loop
    with stats as (
      select s.day, s.required, s.completed
      from public.daily_stats(
        v_group.id,
        least(v_group.from_day, private.user_today(p_user_id)),
        private.user_today(p_user_id),
        p_user_id
      ) s
      where s.required > 0
    ),
    flagged as (
      select day,
        (completed * 100 >= required * v_group.streak_threshold) as good,
        row_number() over (order by day) as rn
      from stats
    ),
    islands as (
      select count(*) as len
      from (
        select rn - row_number() over (order by day) as grp
        from flagged where good
      ) x
      group by grp
    )
    select coalesce(max(len), 0) into v_run from islands;
    v_best := greatest(v_best, v_run);
  end loop;
  return v_best;
end;
$$;

create or replace function public.evaluate_my_achievements()
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_metrics jsonb;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;

  select jsonb_build_object(
    'active_days', (select count(distinct log_date) from public.habit_logs where user_id = v_uid and status = 'done'),
    'habit_done_total', (select count(*) from public.habit_logs where user_id = v_uid and status = 'done'),
    'productivity_done', (
      select count(*) from public.habit_logs l join public.habits h on h.id = l.habit_id
      where l.user_id = v_uid and l.status = 'done' and h.category = 'productivity'
    ),
    'workouts', (select count(*) from public.workouts where user_id = v_uid),
    'workout_minutes', (select coalesce(sum(duration_min), 0) from public.workouts where user_id = v_uid),
    'notes_written', (
      select count(*) from public.daily_entries
      where user_id = v_uid and (btrim(did_today) <> '' or btrim(improve_tomorrow) <> '')
    ),
    'best_streak', private.best_streak_for(v_uid)
  ) into v_metrics;

  return query
    insert into public.user_achievements (user_id, achievement_code)
    select v_uid, a.code
    from public.achievements a
    where (v_metrics ->> a.metric)::integer >= a.threshold
    on conflict do nothing
    returning achievement_code;
end;
$$;

insert into public.achievements (code, name, description, emoji, metric, threshold, xp, sort_order) values
  ('first_day', 'Primer paso', 'Completa tu primer hábito.', '❄️', 'habit_done_total', 1, 10, 10),
  ('week_one', 'Primeros 7 días', 'Registra hábitos cumplidos en 7 días distintos.', '🏆', 'active_days', 7, 50, 20),
  ('streak_7', 'Racha de 7 días', '7 días seguidos cumpliendo el objetivo del grupo.', '🔥', 'best_streak', 7, 70, 30),
  ('streak_14', 'Racha de 14 días', '14 días seguidos cumpliendo el objetivo del grupo.', '🔥', 'best_streak', 14, 140, 40),
  ('streak_30', 'Mes de hierro', '30 días seguidos cumpliendo el objetivo del grupo.', '🧊', 'best_streak', 30, 300, 50),
  ('workouts_10', '10 entrenamientos', 'Registra 10 entrenamientos.', '💪', 'workouts', 10, 100, 60),
  ('workouts_30', '30 entrenamientos', 'Registra 30 entrenamientos.', '🥊', 'workouts', 30, 250, 70),
  ('minutes_600', '10 horas entrenando', 'Acumula 600 minutos de entrenamiento.', '⏱️', 'workout_minutes', 600, 150, 80),
  ('study_20', '20 sesiones de estudio', 'Completa 20 hábitos de productividad/estudio.', '📚', 'productivity_done', 20, 150, 90),
  ('habits_100', 'Centenario', 'Completa 100 hábitos.', '💯', 'habit_done_total', 100, 200, 100),
  ('reflect_14', 'Mente clara', 'Escribe tus notas diarias 14 días.', '🧠', 'notes_written', 14, 100, 110),
  ('arc_complete', 'Winter Arc completado', '90 días activos.', '🏔️', 'active_days', 90, 1000, 120)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Borrado de cuenta (derecho de supresión). Si el usuario es el único admin de
-- un grupo con más miembros, se transfiere al miembro más antiguo.
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group record;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;

  for v_group in
    select m.group_id from public.group_members m
    where m.user_id = v_uid and m.role = 'admin' and private.admin_count(m.group_id) = 1
  loop
    update public.group_members set role = 'admin'
    where group_id = v_group.group_id and user_id = (
      select user_id from public.group_members
      where group_id = v_group.group_id and user_id <> v_uid
      order by joined_at asc limit 1
    );
    if not found then
      update public.groups set deleted_at = now() where id = v_group.group_id;
    end if;
  end loop;

  delete from auth.users where id = v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime (sólo si la publicación de Supabase existe). Realtime respeta RLS.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.habit_logs;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución: nada para anon salvo lo imprescindible.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.create_invitation(uuid, integer, integer) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.get_invitation_preview(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.create_group(text, text, date, date, boolean) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.group_role) to authenticated;
grant execute on function public.transfer_admin(uuid, uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.set_habit_status(uuid, date, public.habit_log_status) to authenticated;
grant execute on function public.daily_stats(uuid, date, date, uuid) to authenticated;
grant execute on function public.group_workout_summary(uuid, date, date) to authenticated;
grant execute on function public.group_member_visibility(uuid) to authenticated;
grant execute on function public.evaluate_my_achievements() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
