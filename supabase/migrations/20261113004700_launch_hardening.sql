-- Endurecimiento para el lanzamiento público (revisión de seguridad, código y privacidad).

-- 1) handle_new_user completo (sustituye a los parches por texto de 004500 y 004600).
--    Las 90 plazas cuentan también para invitaciones de usuarios normales: sólo las
--    invitaciones del staff (y la lista blanca) entran aunque estén agotadas.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
  v_allowlisted boolean := exists (select 1 from private.signup_allowlist a where a.email = lower(new.email));
begin
  if v_code <> '' then
    select * into v_inv from public.group_invitations where code = v_code for update;
    if private.invitation_state(v_inv) <> 'valid' then
      raise exception 'invalid invitation' using errcode = 'WA404';
    end if;
  end if;

  if private.invite_only() and v_inv.id is null and not v_allowlisted then
    update private.access_codes set used_by = new.id, used_at = now()
    where code = v_access and used_by is null and revoked_at is null and expires_at > now();
    if not found then
      raise exception 'access code required' using errcode = 'WA403';
    end if;
    if v_source = '' then v_source := 'invitacion_staff'; end if;
  end if;

  -- Plazas de lanzamiento (con bloqueo para que dos altas simultáneas no se cuelen).
  perform pg_catalog.pg_advisory_xact_lock(hashtext('winter_arc_bootstrap_signup'));
  if not private.invite_only() and not v_allowlisted
     and (v_inv.id is null or not private.is_staff(v_inv.created_by))
     and coalesce(private.signup_spots_left(), 1) <= 0 then
    raise exception 'signup full' using errcode = 'WA429';
  end if;

  if v_inv.id is null then
    if not exists (select 1 from public.profiles) or v_allowlisted then
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

  insert into public.user_settings (user_id, active_group_id, marketing_push)
  values (new.id, v_active, coalesce(v_meta ->> 'marketing_opt_in', '') = 'true');

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

-- 2) Límite de altas: 20 por IP y hora (muchas operadoras móviles comparten IP) y 300 en total.
create or replace function public.signup_rate_check(p_ip text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.check_rate_limit('signup_ip:' || left(coalesce(p_ip, 'unknown'), 64), 20, interval '1 hour');
  perform private.check_rate_limit('signup_global', 300, interval '1 hour');
end $function$;

-- 3) Vista previa de invitación: el límite global sólo como freno de emergencia
--    (con 600/min cualquiera podía agotarlo y bloquear las invitaciones de todos).
create or replace function public.invite_signup_preview(p_code text)
returns table(status text, group_name text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inv public.group_invitations;
  v_state text;
begin
  perform private.check_rate_limit('invite_signup_preview', 20000, interval '1 minute');
  select * into v_inv from public.group_invitations where code = private.normalize_invite_code(p_code);
  v_state := private.invitation_state(v_inv);
  return query
    select v_state, case when v_state = 'valid' then (select g.name from public.groups g where g.id = v_inv.group_id) end;
end;
$function$;

-- 4) Historial de consentimientos de novedades (RGPD art. 7.1: poder demostrarlo).
--    Sólo se añade, nunca se modifica. Los usuarios no tienen acceso directo.
create table if not exists private.consent_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null,
  granted boolean not null,
  source text not null,
  text_version text not null,
  created_at timestamptz not null default now()
);
revoke all on private.consent_log from public, anon, authenticated;

create or replace function private.log_marketing_consent()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' and new.marketing_push then
    insert into private.consent_log (user_id, purpose, granted, source, text_version)
    values (new.user_id, 'marketing', true, 'registro', 'registro-2026-11');
  elsif tg_op = 'UPDATE' and new.marketing_push is distinct from old.marketing_push then
    insert into private.consent_log (user_id, purpose, granted, source, text_version)
    values (new.user_id, 'marketing', new.marketing_push, 'perfil', 'perfil-2026-10');
  end if;
  return new;
end;
$function$;

create or replace trigger user_settings_marketing_consent_log
after insert or update of marketing_push on public.user_settings
for each row execute function private.log_marketing_consent();

-- Las fechas rellenadas al crear la columna eran aproximadas: se anotan como tales.
insert into private.consent_log (user_id, purpose, granted, source, text_version, created_at)
select s.user_id, 'marketing', true, 'aproximado (anterior al registro de consentimientos)', 'perfil-2026-10', s.marketing_consent_at
from public.user_settings s
where s.marketing_push
  and not exists (select 1 from private.consent_log c where c.user_id = s.user_id and c.purpose = 'marketing');

-- 5) Datos físicos (datos de salud): fecha del consentimiento y edad mínima de 14 años.
alter table public.training_profiles add column if not exists consent_at timestamptz not null default now();
alter table public.training_profiles add column if not exists consent_version text not null default 'plan-2026-09';
do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'training_profiles_min_age_14') then
    alter table public.training_profiles add constraint training_profiles_min_age_14 check (birth_year <= 2012) not valid;
  end if;
end
$do$;

-- 6) Limpieza diaria de los contadores de límites (guardan IPs en la clave).
create or replace function private.purge_rate_limits()
returns void
language sql
security definer
set search_path to ''
as $function$
  delete from private.rate_limits where bucket_start < now() - interval '2 days';
$function$;
revoke all on function private.purge_rate_limits() from public, anon, authenticated;

select cron.schedule('winter-arc-purge-rate-limits', '23 4 * * *', 'select private.purge_rate_limits()');
