-- =============================================================================
-- Winter Arc — acceso sólo por invitación
--  * Crear una cuenta exige un código de invitación válido (enlace /join/CODIGO).
--    Al registrarse, la persona entra directamente en el grupo (en la misma transacción).
--  * Excepciones ("creadores", pueden registrarse sin invitación y crear grupos):
--      - la primera cuenta de la instalación (bootstrap del propietario),
--      - los emails de private.signup_allowlist (los añade el propietario).
--  * Sólo los creadores pueden crear grupos nuevos.
-- Se impone en la BD: llamar a la API de Auth directamente no lo evita.
-- =============================================================================

alter table public.profiles add column can_create_groups boolean not null default false;

-- Quien ya creó grupos antes de esta migración conserva el permiso.
update public.profiles p set can_create_groups = true
where exists (select 1 from public.groups g where g.created_by = p.id);

create table private.signup_allowlist (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint signup_allowlist_email_lower check (email = lower(email))
);
alter table private.signup_allowlist enable row level security;
revoke all on private.signup_allowlist from public, anon, authenticated;

-- Alta de usuario con invitación obligatoria.
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
  v_code text := private.normalize_invite_code(v_meta ->> 'invite_code');
  v_inv public.group_invitations;
  v_creator boolean := false;
begin
  if v_code <> '' then
    select * into v_inv from public.group_invitations where code = v_code for update;
    if private.invitation_state(v_inv) <> 'valid' then
      raise exception 'invalid invitation' using errcode = 'WA404';
    end if;
  else
    -- Serializa el alta sin invitación para que sólo haya UNA primera cuenta.
    perform pg_catalog.pg_advisory_xact_lock(hashtext('winter_arc_bootstrap_signup'));
    if not exists (select 1 from public.profiles)
       or exists (select 1 from private.signup_allowlist a where a.email = lower(new.email)) then
      v_creator := true;
    else
      raise exception 'invitation required' using errcode = 'WA403';
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

  if v_inv.id is not null then
    insert into public.group_members (group_id, user_id, role) values (v_inv.group_id, new.id, 'member');
    update public.group_invitations set use_count = use_count + 1 where id = v_inv.id;
  end if;
  return new;
end;
$$;

-- Sólo los creadores pueden crear grupos.
create or replace function private.assert_can_create_groups()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce((select p.can_create_groups from public.profiles p where p.id = auth.uid()), false) then
    raise exception 'cannot create groups' using errcode = 'WA403';
  end if;
end;
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
  perform private.assert_can_create_groups();
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

-- Vista previa para la pantalla de registro (sin sesión): sólo si el código es
-- válido devuelve el nombre del grupo. Rate limit global contra abuso.
create or replace function public.invite_signup_preview(p_code text)
returns table (status text, group_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.group_invitations;
  v_state text;
begin
  perform private.check_rate_limit('invite_signup_preview', 600, interval '1 minute');
  select * into v_inv from public.group_invitations where code = private.normalize_invite_code(p_code);
  v_state := private.invitation_state(v_inv);
  return query
    select v_state, case when v_state = 'valid' then (select g.name from public.groups g where g.id = v_inv.group_id) end;
end;
$$;

-- Gestión de la lista de creadores desde el servidor/SQL (no desde el cliente).
create or replace function public.admin_allow_signup(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.signup_allowlist (email) values (lower(btrim(p_email))) on conflict do nothing;
  update public.profiles p set can_create_groups = true
  from auth.users u where u.id = p.id and lower(u.email) = lower(btrim(p_email));
$$;

revoke execute on function public.invite_signup_preview(text) from public;
revoke execute on function public.admin_allow_signup(text) from public, anon, authenticated;
revoke execute on function private.assert_can_create_groups() from public, anon;
grant execute on function public.invite_signup_preview(text) to anon, authenticated;
grant execute on function public.admin_allow_signup(text) to service_role;
grant execute on function private.assert_can_create_groups() to authenticated;
-- create_group se recrea: mantener el permiso.
revoke execute on function public.create_group(text, text, date, date, boolean) from public, anon;
grant execute on function public.create_group(text, text, date, date, boolean) to authenticated;
