-- =============================================================================
-- Notificaciones push (Web Push). Cada dispositivo guarda su suscripción; el
-- cron horario envía el recordatorio a la hora elegida (hasta 3 h después).
-- =============================================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  user_agent text not null default '' check (length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy "push: select own" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "push: insert own" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push: delete own" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
grant select, insert, delete on public.push_subscriptions to authenticated;

-- Máximo 10 dispositivos por persona (anti-abuso).
create or replace function private.limit_push_subscriptions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.push_subscriptions where user_id = new.user_id) >= 10 then
    delete from public.push_subscriptions where id in (
      select id from public.push_subscriptions where user_id = new.user_id order by created_at limit 1
    );
  end if;
  return new;
end $$;
create trigger limit_push_subscriptions before insert on public.push_subscriptions
  for each row execute function private.limit_push_subscriptions();

alter table private.notification_log drop constraint notification_log_kind;
alter table private.notification_log add constraint notification_log_kind check (kind in ('daily_reminder', 'weekly_summary', 'push_reminder'));

-- Lote de push (service_role): a quién toca avisar ahora, reservado para no duplicar.
create or replace function public.claim_push_batch(p_now timestamptz default now(), p_limit integer default 500)
returns table (user_id uuid, display_name text, group_id uuid, local_date date, period_key text)
language plpgsql security definer set search_path = '' as $$
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
  due as (
    select c.*, c.local_ts::date as local_date, to_char(c.local_ts::date, 'YYYY-MM-DD') as period_key
    from candidates c
    where c.group_id is not null
      and c.local_ts::time >= c.reminder_time
      and c.local_ts::time - c.reminder_time <= interval '3 hours'
  ),
  claimed as (
    insert into private.notification_log as l (user_id, kind, period_key)
    select d.user_id, 'push_reminder', d.period_key from due d order by d.user_id limit p_limit
    on conflict do nothing
    returning l.user_id, l.period_key
  )
  select d.user_id, d.display_name, d.group_id, d.local_date, d.period_key
  from due d join claimed c on c.user_id = d.user_id and c.period_key = d.period_key;
end $$;
revoke execute on function public.claim_push_batch(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_push_batch(timestamptz, integer) to service_role;

-- Guarda un valor de configuración sólo si no existe y devuelve el vigente
-- (evita que dos peticiones simultáneas generen claves VAPID distintas).
create or replace function public.billing_config_set_if_absent(p_key text, p_value text)
returns text
language sql security definer set search_path = '' as $$
  insert into private.billing_config (key, value) values (p_key, p_value) on conflict (key) do nothing;
  select value from private.billing_config where key = p_key;
$$;
revoke execute on function public.billing_config_set_if_absent(text, text) from public, anon, authenticated;
grant execute on function public.billing_config_set_if_absent(text, text) to service_role;
