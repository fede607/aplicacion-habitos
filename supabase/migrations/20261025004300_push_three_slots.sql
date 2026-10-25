-- =============================================================================
-- Avisos push hasta 3 veces al día, sólo si queda algo por hacer:
--   -am    09:00 hora local      → «Buenos días: hoy te toca…»
--   (base) hora de recordatorio  → «Te quedan N hábitos»
--   -late  recordatorio + 1h30   → «Última llamada» (si cae antes de las 23:30)
-- Cada aviso se reserva una sola vez por día en notification_log (sin duplicados).
-- =============================================================================
create or replace function public.claim_push_batch(p_now timestamp with time zone default now(), p_limit integer default 500)
 returns table(user_id uuid, display_name text, group_id uuid, local_date date, period_key text)
 language plpgsql security definer set search_path to '' as $function$
begin
  return query
  with candidates as (
    select s.user_id, p.display_name,
      coalesce(
        (select g.id from public.groups g join public.group_members m on m.group_id = g.id
          where g.id = s.active_group_id and m.user_id = s.user_id and g.deleted_at is null),
        (select m.group_id from public.group_members m join public.groups g on g.id = m.group_id
          where m.user_id = s.user_id and g.deleted_at is null order by m.joined_at limit 1)
      ) as group_id,
      (p_now at time zone p.timezone) as local_ts,
      s.reminder_time
    from public.user_settings s
    join public.profiles p on p.id = s.user_id
    where exists (select 1 from public.push_subscriptions ps where ps.user_id = s.user_id)
  ),
  slots as (
    select c.*, x.suffix, x.at, x.window_len
    from candidates c
    cross join lateral (values
      ('-am', time '09:00', interval '2 hours'),
      ('', c.reminder_time, interval '89 minutes'),
      ('-late', (c.reminder_time + interval '90 minutes')::time, interval '90 minutes')
    ) as x(suffix, at, window_len)
    where c.group_id is not null
      and (x.suffix <> '-late' or c.reminder_time <= time '22:00')
      and (x.suffix <> '-am' or c.reminder_time >= time '11:00')
  ),
  due as (
    select sl.*, sl.local_ts::date as local_date, to_char(sl.local_ts::date, 'YYYY-MM-DD') || sl.suffix as period_key
    from slots sl
    where sl.local_ts::time >= sl.at
      and sl.local_ts::time - sl.at <= sl.window_len
  ),
  claimed as (
    insert into private.notification_log as l (user_id, kind, period_key)
    select d.user_id, 'push_reminder', d.period_key from due d order by d.user_id limit p_limit
    on conflict do nothing
    returning l.user_id, l.period_key
  )
  select d.user_id, d.display_name, d.group_id, d.local_date, d.period_key
  from due d join claimed c on c.user_id = d.user_id and c.period_key = d.period_key;
end $function$;
