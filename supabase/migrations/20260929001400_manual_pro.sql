-- =============================================================================
-- Pro manual: quien paga por PayPal.me recibe el Pro de manos del creador de la
-- sala de pago (el dinero le llega a él). Sólo el creador puede darlo o quitarlo,
-- sólo a miembros de su sala, y sin renovación automática (cancel_at_period_end).
-- =============================================================================
create or replace function public.group_pro_status(p_group_id uuid)
returns table (user_id uuid, pro_until timestamptz, active boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.created_by = auth.uid() and g.requires_pro) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select m.user_id, s.current_period_end, private.is_pro(m.user_id)
    from public.group_members m
    left join public.subscriptions s on s.user_id = m.user_id
    where m.group_id = p_group_id;
end $$;

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

  select greatest(coalesce(s.current_period_end, now()), now()) + make_interval(months => p_months)
    into v_until
    from (select 1) x left join public.subscriptions s on s.user_id = p_user_id;

  insert into public.subscriptions (user_id, provider, status, current_period_end, cancel_at_period_end, updated_at)
  values (p_user_id, 'paypal', 'active', v_until, true, now())
  on conflict (user_id) do update
    set provider = 'paypal', status = 'active', current_period_end = excluded.current_period_end, cancel_at_period_end = true,
        paypal_subscription_id = null, stripe_subscription_id = null, updated_at = now();
  return v_until;
end $$;

revoke all on function public.group_pro_status(uuid) from public, anon;
revoke all on function public.grant_manual_pro(uuid, uuid, int) from public, anon;
grant execute on function public.group_pro_status(uuid) to authenticated;
grant execute on function public.grant_manual_pro(uuid, uuid, int) to authenticated;
