-- =============================================================================
-- Mes de prueba Pro: al entrar por primera vez en una sala de pago, el usuario
-- tiene 1 mes de Pro gratis. Una sola vez por persona (salir y volver a entrar
-- no lo reinicia). Después, 2 €/mes para seguir con Pro.
-- =============================================================================
create table if not exists private.pro_trials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);
revoke all on private.pro_trials from public, anon, authenticated;

create or replace function private.pro_trial_end(p_user uuid)
returns timestamptz
language sql stable security definer set search_path = '' as $$
  select t.started_at + interval '1 month' from private.pro_trials t where t.user_id = p_user;
$$;

-- Pro = suscripción/pago vigente o mes de prueba en curso.
create or replace function private.is_pro(p_user uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user
      and s.status in ('active', 'trialing', 'past_due')
      and (s.current_period_end is null or s.current_period_end > now() - interval '3 days')
  ) or coalesce(private.pro_trial_end(p_user) > now(), false);
$$;

-- Empieza la prueba al entrar en una sala de pago (el creador ya tiene acceso gratis).
create or replace function private.start_pro_trial()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.groups g where g.id = new.group_id and g.requires_pro and g.created_by <> new.user_id) then
    insert into private.pro_trials (user_id) values (new.user_id) on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists start_pro_trial on public.group_members;
create trigger start_pro_trial after insert on public.group_members
  for each row execute function private.start_pro_trial();

-- Quienes ya están en una sala de pago empiezan su mes hoy.
insert into private.pro_trials (user_id)
select distinct m.user_id
from public.group_members m join public.groups g on g.id = m.group_id
where g.requires_pro and g.created_by <> m.user_id
on conflict (user_id) do nothing;

-- Fin de mi prueba (para mostrarlo en la app).
create or replace function public.my_pro_trial_end()
returns timestamptz
language sql stable security definer set search_path = '' as $$
  select private.pro_trial_end((select auth.uid()));
$$;
revoke all on function public.my_pro_trial_end() from public, anon;
grant execute on function public.my_pro_trial_end() to authenticated;

-- Panel del creador: añade el fin de la prueba de cada miembro.
drop function if exists public.group_pro_status(uuid);
create function public.group_pro_status(p_group_id uuid)
returns table (user_id uuid, pro_until timestamptz, active boolean, trial_until timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.created_by = auth.uid() and g.requires_pro) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select m.user_id,
           case when s.status in ('active', 'trialing', 'past_due') then s.current_period_end end,
           private.is_pro(m.user_id),
           private.pro_trial_end(m.user_id)
    from public.group_members m
    left join public.subscriptions s on s.user_id = m.user_id
    where m.group_id = p_group_id;
end $$;
revoke all on function public.group_pro_status(uuid) from public, anon;
grant execute on function public.group_pro_status(uuid) to authenticated;

-- Si paga durante la prueba, el mes pagado empieza al acabar la prueba.
create or replace function public.grant_manual_pro(p_group_id uuid, p_user_id uuid, p_months int)
returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_until timestamptz;
begin
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.created_by = auth.uid() and g.requires_pro) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = p_user_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if p_months not between 0 and 12 then
    raise exception 'invalid months' using errcode = '22023';
  end if;

  if p_months = 0 then
    -- Quitar: sólo afecta a un Pro manual, nunca a una suscripción real de PayPal.
    update public.subscriptions
       set status = 'canceled', current_period_end = now(), cancel_at_period_end = true, updated_at = now()
     where user_id = p_user_id and paypal_subscription_id is null and stripe_subscription_id is null;
    return null;
  end if;

  if exists (select 1 from public.subscriptions s where s.user_id = p_user_id and s.paypal_subscription_id is not null
             and s.status in ('active', 'past_due') and not s.cancel_at_period_end) then
    raise exception 'already subscribed' using errcode = '22023';
  end if;

  select greatest(coalesce(s.current_period_end, now()), coalesce(private.pro_trial_end(p_user_id), now()), now()) + make_interval(months => p_months)
    into v_until
    from (select 1) x left join public.subscriptions s on s.user_id = p_user_id;

  insert into public.subscriptions (user_id, provider, status, current_period_end, cancel_at_period_end, updated_at)
  values (p_user_id, 'paypal', 'active', v_until, true, now())
  on conflict (user_id) do update
    set provider = 'paypal', status = 'active', current_period_end = excluded.current_period_end, cancel_at_period_end = true,
        paypal_subscription_id = null, stripe_subscription_id = null, updated_at = now();
  return v_until;
end $$;
