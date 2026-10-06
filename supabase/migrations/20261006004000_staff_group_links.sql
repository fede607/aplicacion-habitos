-- =============================================================================
-- Acceso privado con enlaces de grupo del staff:
-- - El enlace de un grupo creado por el staff sirve para registrarse y entrar
--   directamente en ese grupo (sin invitación de acceso aparte).
-- - Con el acceso privado activo, sólo el staff crea grupos e invitaciones; los
--   enlaces que no son del staff dejan de funcionar.
-- =============================================================================
create or replace function private.invitation_state(p_inv public.group_invitations)
 returns text language plpgsql stable security definer set search_path to '' as $function$
declare
  v_group public.groups;
  v_count integer;
begin
  if p_inv.id is null then return 'invalid'; end if;
  select * into v_group from public.groups where id = p_inv.group_id;
  if v_group.id is null or v_group.deleted_at is not null then return 'invalid'; end if;
  if p_inv.revoked_at is not null then return 'revoked'; end if;
  if private.invite_only() and not private.is_staff(p_inv.created_by) then return 'revoked'; end if;
  if p_inv.expires_at is not null and p_inv.expires_at <= now() then return 'expired'; end if;
  if p_inv.max_uses is not null and p_inv.use_count >= p_inv.max_uses then return 'exhausted'; end if;
  select count(*) into v_count from public.group_members where group_id = p_inv.group_id;
  if v_count >= v_group.max_members then return 'full'; end if;
  return 'valid';
end;
$function$;

-- ¿Puede este usuario crear grupos e invitaciones?
create or replace function private.can_invite(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.invite_only() or private.is_staff(p_user);
$$;

create or replace function public.i_can_invite() returns boolean
language sql stable security definer set search_path = '' as $$ select private.can_invite((select auth.uid())) $$;

create or replace function private.assert_can_create_groups()
 returns void language plpgsql stable security definer set search_path to '' as $function$
declare
  v_uid uuid := auth.uid();
  v_owned int;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  if exists (select 1 from public.groups g where g.created_by = v_uid and g.created_at > now() - interval '15 seconds') then
    raise exception 'group created too fast' using errcode = 'WA429';
  end if;
  if private.is_staff(v_uid) then
    return;
  end if;
  if private.invite_only() then
    raise exception 'only staff can create groups' using errcode = 'WA403';
  end if;
  select count(*) into v_owned from public.groups g where g.created_by = v_uid;
  if not private.is_pro(v_uid) and v_owned >= 1 then
    raise exception 'group limit free' using errcode = 'WA402';
  end if;
  if v_owned >= 10 then
    raise exception 'too many groups' using errcode = 'WA429';
  end if;
end $function$;

create or replace function public.create_invitation(p_group_id uuid, p_expires_in_hours integer default 168, p_max_uses integer default null::integer)
 returns public.group_invitations language plpgsql security definer set search_path to '' as $function$
declare
  v_inv public.group_invitations;
begin
  if not private.is_group_admin(p_group_id) or not private.can_invite(auth.uid()) then
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

-- Alta: con acceso privado vale una invitación de acceso O un enlace de grupo del staff.
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
  end if;
  return new;
end;
$function$;

revoke all on function public.i_can_invite() from public, anon;
grant execute on function public.i_can_invite() to authenticated;
