-- =============================================================================
-- Hábitos personales: cada persona crea y edita SUS hábitos. Un hábito con
-- owner_id es sólo de esa persona; los hábitos sin owner_id (antiguos) son
-- comunes del grupo. Los grupos nuevos ya no traen hábitos comunes.
-- =============================================================================
alter table public.habits add column if not exists owner_id uuid references auth.users (id) on delete cascade;
create index if not exists habits_group_owner_idx on public.habits (group_id, owner_id) where archived_at is null;

-- ¿Este hábito cuenta para este usuario?
create or replace function private.habit_applies(p_owner uuid, p_user uuid) returns boolean
language sql immutable set search_path = '' as $$ select p_owner is null or p_owner = p_user $$;

-- Permisos: comunes => admin; personales => su dueño (miembro del grupo).
-- Los hábitos personales de otros sólo se ven si su privacidad lo permite.
drop policy if exists habits_select on public.habits;
create policy habits_select on public.habits for select to authenticated using (
  private.is_group_member(group_id)
  and (owner_id is null or owner_id = (select auth.uid()) or private.can_view_member_habits(owner_id, group_id))
);
drop policy if exists habits_insert on public.habits;
create policy habits_insert on public.habits for insert to authenticated with check (
  (owner_id is null and private.is_group_admin(group_id))
  or (owner_id = (select auth.uid()) and private.is_group_member(group_id))
);
drop policy if exists habits_update on public.habits;
create policy habits_update on public.habits for update to authenticated
  using ((owner_id is null and private.is_group_admin(group_id)) or owner_id = (select auth.uid()))
  with check ((owner_id is null and private.is_group_admin(group_id)) or (owner_id = (select auth.uid()) and private.is_group_member(group_id)));

-- El dueño no se puede cambiar.
create or replace function private.protect_habit_columns()
 returns trigger language plpgsql set search_path to '' as $function$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.group_id := old.group_id;
    new.created_by := old.created_by;
    new.owner_id := old.owner_id;
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
$function$;

-- Límites: 40 comunes por grupo, 25 personales por persona y grupo.
create or replace function private.limit_habits_per_group()
 returns trigger language plpgsql set search_path to '' as $function$
begin
  if new.owner_id is null then
    if (select count(*) from public.habits where group_id = new.group_id and owner_id is null and archived_at is null) >= 40 then
      raise exception 'too many habits' using errcode = 'WA422';
    end if;
  elsif (select count(*) from public.habits where group_id = new.group_id and owner_id = new.owner_id and archived_at is null) >= 25 then
    raise exception 'too many habits' using errcode = 'WA422';
  end if;
  return new;
end;
$function$;

-- Sólo puedes marcar hábitos comunes o tuyos.
create or replace function private.validate_habit_log()
 returns trigger language plpgsql security definer set search_path to '' as $function$
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

  select h.group_id, h.is_active, h.archived_at, h.owner_id into v_habit
  from public.habits h where h.id = new.habit_id;

  if not found or v_habit.archived_at is not null or not v_habit.is_active
     or not private.habit_applies(v_habit.owner_id, new.user_id) then
    raise exception 'habit not available' using errcode = 'WA422';
  end if;

  new.group_id := v_habit.group_id;

  perform private.assert_editable_date(new.log_date, new.user_id, private.log_edit_window_days());
  return new;
end;
$function$;

-- Estadísticas: a cada persona sólo le cuentan los hábitos comunes y los suyos.
create or replace function public.daily_stats(p_group_id uuid, p_from date, p_to date, p_user_id uuid default null::uuid)
 returns table(user_id uuid, day date, required integer, completed integer, skipped integer, bonus integer)
 language plpgsql stable set search_path to '' as $function$
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
    select h.id, h.frequency, h.weekdays, h.is_optional, h.starts_on, h.owner_id
    from public.habits h
    where h.group_id = p_group_id and h.is_active and h.archived_at is null
  ),
  sched as (
    select mm.user_id, d.day, h.id as habit_id
    from members mm
    cross join days d
    join hab h on h.starts_on <= d.day
      and not h.is_optional
      and private.habit_applies(h.owner_id, mm.user_id)
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
$function$;

-- Grupos nuevos: sin hábitos comunes; cada uno elige los suyos.
create or replace function public.create_group(p_name text, p_description text default ''::text, p_start_date date default null::date, p_end_date date default null::date, p_seed_defaults boolean default true)
 returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_uid uuid := auth.uid();
  v_start date := coalesce(p_start_date, private.user_today(auth.uid()));
  v_end date := coalesce(p_end_date, coalesce(p_start_date, private.user_today(auth.uid())) + 365);
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  perform private.assert_can_create_groups();
  perform private.check_rate_limit('group_create:' || v_uid::text, 5, interval '1 day');

  insert into public.groups (name, description, start_date, end_date, created_by)
  values (btrim(p_name), coalesce(p_description, ''), v_start, v_end, v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role) values (v_group_id, v_uid, 'admin');

  insert into public.group_invitations (group_id, code, created_by, expires_at)
  values (v_group_id, private.generate_invite_code(), v_uid, null);

  update public.user_settings set active_group_id = v_group_id where user_id = v_uid;
  return v_group_id;
end;
$function$;

-- Se puede indicar el dueño al crear (la política exige que sea uno mismo); nunca al editar.
grant insert (owner_id) on public.habits to authenticated;
