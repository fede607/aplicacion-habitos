-- Correcciones del espacio personal:
-- - max_members mínimo permitido es 2 (las invitaciones a espacios personales están bloqueadas).
-- - Durante el alta no hay sesión: el espacio se crea antes que las preferencias, que lo dejan activo.
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
  return v_id;
end $$;

create or replace function public.create_personal_space()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  perform private.check_rate_limit('personal_space:' || v_uid::text, 5, interval '1 day');
  v_id := private.ensure_personal_space(v_uid, (select timezone from public.profiles where id = v_uid));
  update public.user_settings set active_group_id = v_id where user_id = v_uid;
  return v_id;
end $$;

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
  v_active uuid;
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
  if v_display = '' then v_display := v_username; end if;
  if not private.is_valid_timezone(v_tz) then v_tz := 'Europe/Madrid'; end if;

  insert into public.profiles (id, username, display_name, timezone, can_create_groups)
  values (new.id, v_username, v_display, v_tz, v_creator);

  if v_inv.id is not null then
    insert into public.group_members (group_id, user_id, role) values (v_inv.group_id, new.id, 'member');
    update public.group_invitations set use_count = use_count + 1 where id = v_inv.id;
    v_active := v_inv.group_id;
  else
    v_active := private.ensure_personal_space(new.id, v_tz);
  end if;

  insert into public.user_settings (user_id, active_group_id) values (new.id, v_active);

  if v_source <> '' then
    insert into private.signup_sources (user_id, source) values (new.id, v_source) on conflict do nothing;
  elsif v_inv.id is not null then
    insert into private.signup_sources (user_id, source) values (new.id, 'invitacion') on conflict do nothing;
  end if;

  if v_inv.id is not null then
    perform private.reward_referral(v_inv.created_by, new.id);
  end if;
  return new;
end;
$function$;

revoke all on function private.ensure_personal_space(uuid, text) from public, anon, authenticated;
revoke all on function public.create_personal_space() from public, anon;
grant execute on function public.create_personal_space() to authenticated;
