-- =============================================================================
-- Acceso privado: mientras esté activado, sólo se puede crear cuenta con una
-- invitación personal de un solo uso creada por el staff. Los enlaces de grupo
-- sirven para unir a gente que ya tiene cuenta, no para crear cuentas nuevas.
-- =============================================================================
create table if not exists private.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table private.app_settings enable row level security;
insert into private.app_settings (key, value) values ('invite_only', 'true')
on conflict (key) do update set value = 'true', updated_at = now();

create table if not exists private.access_codes (
  code text primary key check (code ~ '^[A-Z2-9]{10}$'),
  note text not null default '' check (char_length(note) <= 60),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);
alter table private.access_codes enable row level security;

create or replace function private.invite_only() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true' from private.app_settings where key = 'invite_only'), false);
$$;

create or replace function private.normalize_access_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function private.access_code_valid(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.access_codes c
    where c.code = private.normalize_access_code(p_code)
      and c.used_by is null and c.revoked_at is null and c.expires_at > now()
  );
$$;

-- Público: ¿el registro está cerrado? (para mostrar el aviso en la web)
create or replace function public.signup_is_invite_only() returns boolean
language sql stable security definer set search_path = '' as $$ select private.invite_only() $$;

-- Sólo servidor (service_role): ¿esta invitación sirve?
create or replace function public.access_code_check(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$ select private.access_code_valid(p_code) $$;

-- Alta: con el acceso privado activado exige invitación válida y la gasta.
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
  if private.invite_only()
     and not exists (select 1 from private.signup_allowlist a where a.email = lower(new.email)) then
    update private.access_codes set used_by = new.id, used_at = now()
    where code = v_access and used_by is null and revoked_at is null and expires_at > now();
    if not found then
      raise exception 'access code required' using errcode = 'WA403';
    end if;
    if v_source = '' then v_source := 'invitacion_staff'; end if;
  end if;

  if v_code <> '' then
    select * into v_inv from public.group_invitations where code = v_code for update;
    if private.invitation_state(v_inv) <> 'valid' then
      raise exception 'invalid invitation' using errcode = 'WA404';
    end if;
  else
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

-- Staff: crear invitaciones de un solo uso.
create or replace function public.staff_create_access_code(p_note text default '', p_days integer default 14)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform private.check_rate_limit('access_create:' || auth.uid()::text, 100, interval '1 day');
  loop
    v_bytes := extensions.gen_random_bytes(10);
    v_code := '';
    for i in 0..9 loop
      v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from private.access_codes where code = v_code);
  end loop;
  insert into private.access_codes (code, note, created_by, expires_at)
  values (v_code, left(btrim(coalesce(p_note, '')), 60), auth.uid(), now() + make_interval(days => greatest(1, least(coalesce(p_days, 14), 60))));
  return v_code;
end $$;

create or replace function public.staff_access_codes()
returns table (code text, note text, created_at timestamptz, expires_at timestamptz, used_at timestamptz, used_username text, revoked boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select c.code, c.note, c.created_at, c.expires_at, c.used_at, p.username, c.revoked_at is not null
  from private.access_codes c left join public.profiles p on p.id = c.used_by
  order by c.created_at desc limit 100;
end $$;

create or replace function public.staff_revoke_access_code(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update private.access_codes set revoked_at = now() where code = private.normalize_access_code(p_code) and used_by is null;
end $$;

create or replace function public.staff_set_invite_only(p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into private.app_settings (key, value) values ('invite_only', case when p_on then 'true' else 'false' end)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

revoke all on function public.signup_is_invite_only(), public.access_code_check(text),
  public.staff_create_access_code(text, integer), public.staff_access_codes(),
  public.staff_revoke_access_code(text), public.staff_set_invite_only(boolean) from public, anon, authenticated;
grant execute on function public.signup_is_invite_only() to anon, authenticated;
grant execute on function public.access_code_check(text) to service_role;
grant execute on function public.staff_create_access_code(text, integer), public.staff_access_codes(),
  public.staff_revoke_access_code(text), public.staff_set_invite_only(boolean) to authenticated;
