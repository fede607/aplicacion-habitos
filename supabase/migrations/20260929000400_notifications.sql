-- =============================================================================
-- Winter Arc — notificaciones por email
--  * Cada usuario elige recibir recordatorio diario y/o resumen semanal.
--  * Puede usar el email de su cuenta o otro, que DEBE verificar (evita usar la
--    app para enviar correos a terceros).
--  * El envío lo hace un cron del servidor con la service role; las funciones de
--    lote sólo son ejecutables por service_role.
-- =============================================================================

alter table public.user_settings
  add column email_daily_reminder boolean not null default false,
  add column email_weekly_summary boolean not null default true,
  add column notification_email text,
  add column notification_email_verified_at timestamptz,
  add column unsubscribe_token uuid not null default gen_random_uuid(),
  add constraint user_settings_notification_email_format check (
    notification_email is null
    or (char_length(notification_email) <= 254 and notification_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );

create unique index user_settings_unsubscribe_token_key on public.user_settings (unsubscribe_token);

-- El usuario sólo puede activar/desactivar tipos de email; el email en sí sólo
-- cambia mediante verificación.
grant update (email_daily_reminder, email_weekly_summary) on public.user_settings to authenticated;

-- Verificaciones pendientes (privado: el usuario nunca ve el token).
create table private.email_verifications (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index email_verifications_token_hash_key on private.email_verifications (token_hash);
alter table private.email_verifications enable row level security;

-- Registro de envíos: garantiza como mucho un email por usuario/tipo/periodo.
create table private.notification_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  period_key text not null,
  status text not null default 'claimed',
  created_at timestamptz not null default now(),
  primary key (user_id, kind, period_key),
  constraint notification_log_kind check (kind in ('daily_reminder', 'weekly_summary')),
  constraint notification_log_status check (status in ('claimed', 'sent', 'skipped'))
);
create index notification_log_created_idx on private.notification_log (created_at);
alter table private.notification_log enable row level security;

revoke all on private.email_verifications, private.notification_log from public, anon, authenticated;

-- El cron (service_role) necesita ver los registros de todos para calcular estadísticas.
create or replace function private.can_view_member_habits(p_owner uuid, p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.role()) = 'service_role'
    or p_owner = (select auth.uid())
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

-- -----------------------------------------------------------------------------
-- Email de notificaciones: estado visible para el propio usuario
-- -----------------------------------------------------------------------------
create or replace function public.my_notification_email()
returns table (account_email text, account_confirmed boolean, notification_email text, verified boolean, pending_email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text,
    u.email_confirmed_at is not null,
    s.notification_email,
    s.notification_email_verified_at is not null,
    (select v.email from private.email_verifications v where v.user_id = u.id and v.expires_at > now())
  from auth.users u
  join public.user_settings s on s.user_id = u.id
  where u.id = auth.uid();
$$;

-- Volver a usar el email de la cuenta.
create or replace function public.use_account_email_for_notifications()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_settings
  set notification_email = null, notification_email_verified_at = null
  where user_id = auth.uid();
  delete from private.email_verifications where user_id = auth.uid();
$$;

-- Crea (o sustituye) una verificación. SÓLO service_role: el token en claro
-- nunca debe llegar al usuario salvo por email.
create or replace function public.admin_create_email_verification(p_user_id uuid, p_email text, p_token_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email is null or char_length(p_email) > 254 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = 'WA422';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token' using errcode = 'WA422';
  end if;
  perform private.check_rate_limit('email_verify:' || p_user_id::text, 5, interval '1 hour');

  insert into private.email_verifications (user_id, email, token_hash, expires_at)
  values (p_user_id, lower(p_email), p_token_hash, now() + interval '24 hours')
  on conflict (user_id) do update
    set email = excluded.email, token_hash = excluded.token_hash, expires_at = excluded.expires_at, created_at = now();
end;
$$;

-- Confirmar desde el enlace del email (el token es el secreto: 256 bits).
create or replace function public.verify_notification_email(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.email_verifications;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return false;
  end if;
  delete from private.email_verifications
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and expires_at > now()
  returning * into v_row;
  if v_row.user_id is null then
    return false;
  end if;
  update public.user_settings
  set notification_email = v_row.email, notification_email_verified_at = now()
  where user_id = v_row.user_id;
  return true;
end;
$$;

-- Baja con un clic (enlace en cada email).
create or replace function public.unsubscribe_emails(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_settings
  set email_daily_reminder = false, email_weekly_summary = false
  where unsubscribe_token = p_token;
  return found;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lote de envío (service_role). Devuelve a quién toca escribir AHORA y reserva
-- el envío en notification_log para que dos crons simultáneos no dupliquen.
--   daily_reminder: desde su hora de recordatorio hasta las 23:59 locales.
--   weekly_summary: domingo desde las 19:00 locales.
-- -----------------------------------------------------------------------------
create or replace function public.claim_notification_batch(p_kind text, p_now timestamptz default now(), p_limit integer default 200)
returns table (
  user_id uuid,
  email text,
  display_name text,
  timezone text,
  group_id uuid,
  local_date date,
  period_key text,
  unsubscribe_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('daily_reminder', 'weekly_summary') then
    raise exception 'invalid kind' using errcode = 'WA422';
  end if;

  return query
  with candidates as (
    select s.user_id,
      case
        when s.notification_email is not null and s.notification_email_verified_at is not null then s.notification_email
        when u.email_confirmed_at is not null then u.email::text
      end as email,
      p.display_name,
      p.timezone,
      coalesce(
        (select g.id from public.groups g join public.group_members m on m.group_id = g.id
          where g.id = s.active_group_id and m.user_id = s.user_id and g.deleted_at is null),
        (select m.group_id from public.group_members m join public.groups g on g.id = m.group_id
          where m.user_id = s.user_id and g.deleted_at is null order by m.joined_at limit 1)
      ) as group_id,
      (p_now at time zone p.timezone) as local_ts,
      s.reminder_time,
      s.unsubscribe_token
    from public.user_settings s
    join public.profiles p on p.id = s.user_id
    join auth.users u on u.id = s.user_id
    where (p_kind = 'daily_reminder' and s.email_daily_reminder)
       or (p_kind = 'weekly_summary' and s.email_weekly_summary)
  ),
  due as (
    select c.*, c.local_ts::date as local_date,
      case when p_kind = 'daily_reminder'
        then to_char(c.local_ts::date, 'YYYY-MM-DD')
        else to_char(date_trunc('week', c.local_ts)::date, 'YYYY-MM-DD')
      end as period_key
    from candidates c
    where c.email is not null
      and c.group_id is not null
      and (
        (p_kind = 'daily_reminder' and c.local_ts::time >= c.reminder_time)
        or (p_kind = 'weekly_summary' and extract(isodow from c.local_ts) = 7 and c.local_ts::time >= time '19:00')
      )
  ),
  claimed as (
    insert into private.notification_log as l (user_id, kind, period_key)
    select d.user_id, p_kind, d.period_key
    from due d
    order by d.user_id
    limit p_limit
    on conflict do nothing
    returning l.user_id, l.period_key
  )
  select d.user_id, d.email, d.display_name, d.timezone, d.group_id, d.local_date, d.period_key, d.unsubscribe_token
  from due d
  join claimed c on c.user_id = d.user_id and c.period_key = d.period_key;
end;
$$;

create or replace function public.finish_notification(p_user_id uuid, p_kind text, p_period_key text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status = 'failed' then
    -- Se libera la reserva para reintentar en la próxima ejecución.
    delete from private.notification_log where user_id = p_user_id and kind = p_kind and period_key = p_period_key;
  else
    update private.notification_log set status = p_status
    where user_id = p_user_id and kind = p_kind and period_key = p_period_key;
  end if;
  delete from private.notification_log where created_at < now() - interval '60 days';
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke execute on function public.my_notification_email() from public, anon;
revoke execute on function public.use_account_email_for_notifications() from public, anon;
revoke execute on function public.admin_create_email_verification(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.verify_notification_email(text) from public;
revoke execute on function public.unsubscribe_emails(uuid) from public;
revoke execute on function public.claim_notification_batch(text, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.finish_notification(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.my_notification_email() to authenticated;
grant execute on function public.use_account_email_for_notifications() to authenticated;
grant execute on function public.verify_notification_email(text) to anon, authenticated;
grant execute on function public.unsubscribe_emails(uuid) to anon, authenticated;
grant execute on function public.admin_create_email_verification(uuid, text, text) to service_role;
grant execute on function public.claim_notification_batch(text, timestamptz, integer) to service_role;
grant execute on function public.finish_notification(uuid, text, text, text) to service_role;

-- service_role necesita leer estas tablas para componer los emails.
grant usage on schema public to service_role;
grant select on public.profiles, public.user_settings, public.groups, public.group_members, public.habits,
  public.habit_logs, public.workouts to service_role;
grant execute on function public.daily_stats(uuid, date, date, uuid) to service_role;
grant execute on function public.group_workout_summary(uuid, date, date) to service_role;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
