-- =============================================================================
-- Avisos de novedades y ofertas: sólo a quien lo activa (por defecto NO).
-- El staff puede enviar uno como máximo cada 7 días.
-- =============================================================================
alter table public.user_settings add column if not exists marketing_push boolean not null default false;
grant update (marketing_push) on public.user_settings to authenticated;

-- Cuántas personas lo recibirían ahora (con novedades activadas y avisos en algún dispositivo).
create or replace function public.staff_marketing_audience()
returns table (people integer, last_sent_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select
    (select count(distinct s.user_id)::int from public.user_settings s
      where s.marketing_push and exists (select 1 from public.push_subscriptions ps where ps.user_id = s.user_id)),
    (select nullif(value, '')::timestamptz from private.app_settings where key = 'last_marketing_push');
end $$;

-- Reserva un envío (máx. 1 cada 7 días) y devuelve a quién mandarlo.
create or replace function public.staff_marketing_claim()
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare
  v_last timestamptz;
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select nullif(value, '')::timestamptz into v_last from private.app_settings where key = 'last_marketing_push' for update;
  if v_last is not null and v_last > now() - interval '7 days' then
    raise exception 'too soon' using errcode = 'WA429';
  end if;
  insert into private.app_settings (key, value) values ('last_marketing_push', now()::text)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return query
  select distinct s.user_id from public.user_settings s
  where s.marketing_push and exists (select 1 from public.push_subscriptions ps where ps.user_id = s.user_id);
end $$;

revoke all on function public.staff_marketing_audience(), public.staff_marketing_claim() from public, anon;
grant execute on function public.staff_marketing_audience(), public.staff_marketing_claim() to authenticated;
