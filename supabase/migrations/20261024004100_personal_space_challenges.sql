-- =============================================================================
-- Versión individual: cada persona tiene su "espacio personal" (un grupo de 1,
-- sin invitaciones ni comparaciones) y retos personales con medallas.
-- Los grupos existentes no cambian.
-- =============================================================================
alter table public.groups add column if not exists is_personal boolean not null default false;
create unique index if not exists groups_one_personal_per_user on public.groups (created_by) where is_personal and deleted_at is null;

-- Un espacio personal no admite invitaciones.
create or replace function private.invitation_state(p_inv public.group_invitations)
 returns text language plpgsql stable security definer set search_path to '' as $function$
declare
  v_group public.groups;
  v_count integer;
begin
  if p_inv.id is null then return 'invalid'; end if;
  select * into v_group from public.groups where id = p_inv.group_id;
  if v_group.id is null or v_group.deleted_at is not null or v_group.is_personal then return 'invalid'; end if;
  if p_inv.revoked_at is not null then return 'revoked'; end if;
  if private.invite_only() and not private.is_staff(p_inv.created_by) then return 'revoked'; end if;
  if p_inv.expires_at is not null and p_inv.expires_at <= now() then return 'expired'; end if;
  if p_inv.max_uses is not null and p_inv.use_count >= p_inv.max_uses then return 'exhausted'; end if;
  select count(*) into v_count from public.group_members where group_id = p_inv.group_id;
  if v_count >= v_group.max_members then return 'full'; end if;
  return 'valid';
end;
$function$;

-- Crea (o reutiliza) el espacio personal de un usuario. Uso interno.
create or replace function private.ensure_personal_space(p_user uuid, p_tz text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_start date := (now() at time zone coalesce(nullif(p_tz, ''), 'Europe/Madrid'))::date;
begin
  select id into v_id from public.groups where created_by = p_user and is_personal and deleted_at is null;
  if v_id is null then
    insert into public.groups (name, description, start_date, end_date, created_by, is_personal, max_members, comparison_enabled)
    values ('Mi Year Arc', '', v_start, v_start + 365, p_user, true, 2, false)
    returning id into v_id;
    insert into public.group_members (group_id, user_id, role) values (v_id, p_user, 'admin');
  end if;
  update public.user_settings set active_group_id = v_id where user_id = p_user;
  return v_id;
end $$;

-- Cualquier usuario puede crear su espacio personal (no cuenta como crear grupos).
create or replace function public.create_personal_space()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  perform private.check_rate_limit('personal_space:' || v_uid::text, 5, interval '1 day');
  return private.ensure_personal_space(v_uid, (select timezone from public.profiles where id = v_uid));
end $$;

-- No se pueden crear invitaciones de un espacio personal.
create or replace function public.create_invitation(p_group_id uuid, p_expires_in_hours integer default 168, p_max_uses integer default null::integer)
 returns public.group_invitations language plpgsql security definer set search_path to '' as $function$
declare
  v_inv public.group_invitations;
begin
  if not private.is_group_admin(p_group_id) or not private.can_invite(auth.uid())
     or exists (select 1 from public.groups g where g.id = p_group_id and g.is_personal) then
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
$function$;

-- Alta: quien entra sin enlace de grupo recibe directamente su espacio personal.
create or replace function private.handle_new_user()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(regexp_replace(coalesce(v_meta ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'));
  v_display text := left(btrim(coalesce(nullif(v_meta ->> 'display_name', ''), nullif(v_meta ->> 'full_name', ''), v_meta ->> 'name', '')), 40);
  v_tz text := coalesce(v_meta ->> 'timezone', 'Europe/Madrid');
  v_code text := private.normalize_invite_code(v_meta ->> 'invite_code');
  v_access text := private.normalize_access_code(v_meta ->> 'access_code');
  v_source text := lower(left(regexp_replace(coalesce(v_meta ->> 'signup_source', ''), '[^a-zA-Z0-9_-]', '', 'g'), 32));
  v_inv public.group_invitations;
  v_creator boolean := false;
begin
  if v_code <> '' then
    select * into v_inv from public.group_invitations where code = v_code for update;
    if private.invitation_state(v_inv) <> 'valid' then
      raise exception 'invalid invitation' using errcode = 'WA404';
    end if;
  end if;

  if private.invite_only() and v_inv.id is null
     and not exists (select 1 from private.signup_allowlist a where a.email = lower(new.email)) then
    update private.access_codes set used_by = new.id, used_at = now()
    where code = v_access and used_by is null and revoked_at is null and expires_at > now();
    if not found then
      raise exception 'access code required' using errcode = 'WA403';
    end if;
    if v_source = '' then v_source := 'invitacion_staff'; end if;
  end if;

  if v_inv.id is null then
    perform pg_catalog.pg_advisory_xact_lock(hashtext('winter_arc_bootstrap_signup'));
    if not exists (select 1 from public.profiles)
       or exists (select 1 from private.signup_allowlist a where a.email = lower(new.email)) then
      v_creator := true;
    end if;
  end if;

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

  insert into public.profiles (id, username, display_name, timezone, can_create_groups)
  values (new.id, v_username, v_display, v_tz, v_creator);
  insert into public.user_settings (user_id, active_group_id) values (new.id, v_inv.group_id);

  if v_source <> '' then
    insert into private.signup_sources (user_id, source) values (new.id, v_source) on conflict do nothing;
  elsif v_inv.id is not null then
    insert into private.signup_sources (user_id, source) values (new.id, 'invitacion') on conflict do nothing;
  end if;

  if v_inv.id is not null then
    insert into public.group_members (group_id, user_id, role) values (v_inv.group_id, new.id, 'member');
    update public.group_invitations set use_count = use_count + 1 where id = v_inv.id;
    perform private.reward_referral(v_inv.created_by, new.id);
  else
    perform private.ensure_personal_space(new.id, v_tz);
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Retos personales (7, 21 o 30 días). Cada día se marca como cumplido.
-- ---------------------------------------------------------------------------
create table if not exists public.personal_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null default '🎯' check (char_length(emoji) <= 16),
  title text not null check (char_length(btrim(title)) between 2 and 60),
  days smallint not null check (days in (7, 21, 30)),
  started_on date not null,
  completed_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists personal_challenges_user_idx on public.personal_challenges (user_id, created_at desc);
alter table public.personal_challenges enable row level security;
create policy personal_challenges_select on public.personal_challenges for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.challenge_checkins (
  challenge_id uuid not null references public.personal_challenges (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, day)
);
alter table public.challenge_checkins enable row level security;
create policy challenge_checkins_select on public.challenge_checkins for select to authenticated using (
  exists (select 1 from public.personal_challenges c where c.id = challenge_id and c.user_id = (select auth.uid()))
);

create or replace function public.start_challenge(p_title text, p_emoji text, p_days integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = 'WA403'; end if;
  if p_days not in (7, 21, 30) then raise exception 'invalid days' using errcode = 'WA422'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 60 then raise exception 'invalid title' using errcode = 'WA422'; end if;
  if (select count(*) from public.personal_challenges where user_id = v_uid and completed_at is null and abandoned_at is null) >= 5 then
    raise exception 'too many challenges' using errcode = 'WA429';
  end if;
  perform private.check_rate_limit('challenge_start:' || v_uid::text, 20, interval '1 day');
  insert into public.personal_challenges (user_id, emoji, title, days, started_on)
  values (v_uid, left(coalesce(nullif(btrim(p_emoji), ''), '🎯'), 16), btrim(p_title), p_days, private.user_today(v_uid))
  returning id into v_id;
  return v_id;
end $$;

-- Marca o desmarca un día (sólo hoy o ayer, dentro del reto). Devuelve si el reto queda completado.
create or replace function public.toggle_challenge_day(p_challenge_id uuid, p_day date)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_c public.personal_challenges;
  v_today date;
  v_done integer;
begin
  select * into v_c from public.personal_challenges where id = p_challenge_id and user_id = v_uid for update;
  if v_c.id is null or v_c.abandoned_at is not null or v_c.completed_at is not null then
    raise exception 'not found' using errcode = 'WA404';
  end if;
  v_today := private.user_today(v_uid);
  if p_day > v_today or p_day < v_today - 1 or p_day < v_c.started_on or p_day > v_c.started_on + v_c.days - 1 then
    raise exception 'invalid day' using errcode = 'WA422';
  end if;
  if exists (select 1 from public.challenge_checkins where challenge_id = v_c.id and day = p_day) then
    delete from public.challenge_checkins where challenge_id = v_c.id and day = p_day;
  else
    insert into public.challenge_checkins (challenge_id, day) values (v_c.id, p_day);
  end if;
  select count(*) into v_done from public.challenge_checkins where challenge_id = v_c.id;
  if v_done >= v_c.days then
    update public.personal_challenges set completed_at = now() where id = v_c.id;
    return true;
  end if;
  return false;
end $$;

create or replace function public.abandon_challenge(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.personal_challenges set abandoned_at = now()
  where id = p_challenge_id and user_id = auth.uid() and completed_at is null and abandoned_at is null;
end $$;

revoke all on function public.create_personal_space(), public.start_challenge(text, text, integer),
  public.toggle_challenge_day(uuid, date), public.abandon_challenge(uuid) from public, anon;
grant execute on function public.create_personal_space(), public.start_challenge(text, text, integer),
  public.toggle_challenge_day(uuid, date), public.abandon_challenge(uuid) to authenticated;
revoke all on function private.ensure_personal_space(uuid, text) from public, anon, authenticated;
grant select on public.personal_challenges, public.challenge_checkins to authenticated;
