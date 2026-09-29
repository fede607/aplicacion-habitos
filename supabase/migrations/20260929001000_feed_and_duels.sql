-- =============================================================================
-- Winter Arc — feed en directo del grupo + duelos semanales
--  * group_activity: eventos generados SÓLO por la BD (triggers/RPC) a partir de
--    datos reales. El cliente no puede escribir eventos.
--  * activity_reactions: reacciones con emoji (una de cada tipo por persona).
--  * duels: retos 1 vs 1 de una semana ISO; se gestionan sólo por RPC.
-- Privacidad: un evento sólo lo ve quien puede ver los hábitos de su autor.
-- =============================================================================

-- Feed ------------------------------------------------------------------------
create table public.group_activity (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('day_complete', 'achievement', 'rank_up', 'duel_accepted', 'joined')),
  event_key text not null check (char_length(event_key) <= 80),
  payload jsonb not null default '{}'::jsonb check (pg_column_size(payload) < 2048),
  created_at timestamptz not null default now(),
  unique (group_id, user_id, kind, event_key)
);
create index group_activity_feed_idx on public.group_activity (group_id, created_at desc);

create table public.activity_reactions (
  activity_id bigint not null references public.group_activity (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '💪', '👏', '🫡')),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id, emoji)
);
create index activity_reactions_group_idx on public.activity_reactions (group_id);

alter table public.group_activity enable row level security;
alter table public.activity_reactions enable row level security;

create policy group_activity_select on public.group_activity for select to authenticated
  using (private.can_view_member_habits(user_id, group_id));

create policy activity_reactions_select on public.activity_reactions for select to authenticated
  using (private.is_group_member(group_id));
create policy activity_reactions_insert on public.activity_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_group_member(group_id)
    and exists (select 1 from public.group_activity a where a.id = activity_id and a.group_id = activity_reactions.group_id)
  );
create policy activity_reactions_delete on public.activity_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.group_activity to authenticated;
grant select, delete on public.activity_reactions to authenticated;
grant insert (activity_id, emoji) on public.activity_reactions to authenticated;

-- group_id de la reacción siempre se deriva del evento (no se puede falsear).
create or replace function private.set_reaction_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select a.group_id into new.group_id from public.group_activity a where a.id = new.activity_id;
  new.user_id := (select auth.uid());
  perform private.check_rate_limit('reaction:' || new.user_id::text, 120, interval '1 hour');
  return new;
end;
$$;
create trigger activity_reactions_set_group before insert on public.activity_reactions
  for each row execute function private.set_reaction_group();

create or replace function private.emit_activity(p_group uuid, p_user uuid, p_kind text, p_key text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.group_activity (group_id, user_id, kind, event_key, payload)
  values (p_group, p_user, p_kind, p_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (group_id, user_id, kind, event_key) do nothing;
$$;
revoke execute on function private.emit_activity(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

-- Día cerrado al 100 % (sólo el día de hoy del usuario: rellenar días pasados no llena el feed).
create or replace function private.activity_on_habit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_required integer;
  v_completed integer;
begin
  if new.status <> 'done' or new.log_date <> private.user_today(new.user_id) then
    return new;
  end if;
  select d.required, d.completed into v_required, v_completed
  from public.daily_stats(new.group_id, new.log_date, new.log_date, new.user_id) d
  where d.user_id = new.user_id;
  if coalesce(v_required, 0) > 0 and v_completed >= v_required then
    perform private.emit_activity(new.group_id, new.user_id, 'day_complete', new.log_date::text,
      jsonb_build_object('date', new.log_date, 'habits', v_required));
  end if;
  return new;
end;
$$;
create trigger habit_logs_activity after insert or update of status on public.habit_logs
  for each row execute function private.activity_on_habit_log();

-- Logro desbloqueado (se publica en los grupos del usuario).
create or replace function private.activity_on_achievement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ach public.achievements;
  v_group uuid;
begin
  select * into v_ach from public.achievements where code = new.achievement_code;
  for v_group in select m.group_id from public.group_members m where m.user_id = new.user_id loop
    perform private.emit_activity(v_group, new.user_id, 'achievement', new.achievement_code,
      jsonb_build_object('code', v_ach.code, 'name', v_ach.name, 'emoji', v_ach.emoji));
  end loop;
  return new;
end;
$$;
create trigger user_achievements_activity after insert on public.user_achievements
  for each row execute function private.activity_on_achievement();

-- Nuevo miembro.
create or replace function private.activity_on_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.emit_activity(new.group_id, new.user_id, 'joined', 'join', '{}'::jsonb);
  return new;
end;
$$;
create trigger group_members_activity after insert on public.group_members
  for each row execute function private.activity_on_join();

-- Subida de rango. El snapshot lo escribe el propio usuario, así que sólo se
-- publica si es coherente con el algoritmo: la división corresponde al score y
-- no sube más de una división por día transcurrido.
create or replace function private.tier_for_score(p_score numeric)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select (count(*) - 1)::smallint
  from unnest(array[0, 6, 12, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 74, 78, 81, 84, 87, 89.5, 92, 95]::numeric[]) m
  where m <= p_score;
$$;

create or replace function private.activity_on_rank_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev public.rank_snapshots;
begin
  if new.snapshot_date <> private.user_today(new.user_id) then
    return new;
  end if;
  select * into v_prev from public.rank_snapshots s
  where s.user_id = new.user_id and s.group_id = new.group_id and s.snapshot_date < new.snapshot_date
  order by s.snapshot_date desc limit 1;
  if v_prev.user_id is null
     or new.tier_index <= v_prev.tier_index
     or new.tier_index > private.tier_for_score(new.discipline_score)
     or new.tier_index - v_prev.tier_index > (new.snapshot_date - v_prev.snapshot_date) then
    return new;
  end if;
  perform private.emit_activity(new.group_id, new.user_id, 'rank_up', new.snapshot_date::text || ':' || new.tier_index,
    jsonb_build_object('from', v_prev.tier_index, 'to', new.tier_index));
  return new;
end;
$$;
create trigger rank_snapshots_activity after insert or update of tier_index on public.rank_snapshots
  for each row execute function private.activity_on_rank_snapshot();

-- Duelos ----------------------------------------------------------------------
create table public.duels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  challenger_id uuid not null references public.profiles (id) on delete cascade,
  opponent_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (challenger_id <> opponent_id)
);
create unique index duels_one_per_pair_week on public.duels
  (group_id, least(challenger_id, opponent_id), greatest(challenger_id, opponent_id), week_start)
  where status in ('pending', 'accepted');
create index duels_group_week_idx on public.duels (group_id, week_start desc);

alter table public.duels enable row level security;
create policy duels_select on public.duels for select to authenticated
  using (private.is_group_member(group_id));
grant select on public.duels to authenticated;

create or replace function private.shares_habits(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.share_habits from public.user_settings s where s.user_id = p_user), false);
$$;

create or replace function public.create_duel(p_group_id uuid, p_opponent_id uuid, p_week_start date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := private.user_today(auth.uid());
  v_this_week date := v_today - (extract(isodow from v_today)::integer - 1);
  v_id uuid;
begin
  if v_uid is null or not private.is_group_member(p_group_id) then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  if p_opponent_id = v_uid or not exists (
    select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = p_opponent_id
  ) then
    raise exception 'invalid opponent' using errcode = 'WA422';
  end if;
  if extract(isodow from p_week_start) <> 1 or p_week_start not in (v_this_week, v_this_week + 7) then
    raise exception 'invalid week' using errcode = 'WA422';
  end if;
  if not private.shares_habits(v_uid) or not private.shares_habits(p_opponent_id) then
    raise exception 'habits not shared' using errcode = 'WA412';
  end if;
  if (select count(*) from public.duels d
      where d.challenger_id = v_uid and d.week_start = p_week_start and d.status in ('pending', 'accepted')) >= 3 then
    raise exception 'too many duels' using errcode = 'WA429';
  end if;
  perform private.check_rate_limit('duel_create:' || v_uid::text, 20, interval '1 day');

  insert into public.duels (group_id, challenger_id, opponent_id, week_start)
  values (p_group_id, v_uid, p_opponent_id, p_week_start)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'duel exists' using errcode = 'WA409';
end;
$$;

create or replace function public.respond_duel(p_duel_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duel public.duels;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if v_duel.id is null or v_duel.opponent_id <> auth.uid() then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  if v_duel.status <> 'pending' or v_duel.week_start + 6 < private.user_today(auth.uid()) then
    raise exception 'duel closed' using errcode = 'WA409';
  end if;
  update public.duels
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_duel_id;
  if p_accept then
    perform private.emit_activity(v_duel.group_id, v_duel.challenger_id, 'duel_accepted', v_duel.id::text,
      jsonb_build_object('duel_id', v_duel.id, 'opponent_id', v_duel.opponent_id, 'week_start', v_duel.week_start));
  end if;
end;
$$;

create or replace function public.cancel_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.duels set status = 'cancelled', responded_at = now()
  where id = p_duel_id and challenger_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
end;
$$;

revoke execute on function public.create_duel(uuid, uuid, date), public.respond_duel(uuid, boolean), public.cancel_duel(uuid) from public, anon;
grant execute on function public.create_duel(uuid, uuid, date), public.respond_duel(uuid, boolean), public.cancel_duel(uuid) to authenticated;

-- Tiempo real -----------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.group_activity, public.activity_reactions, public.duels;
  end if;
end;
$$;
