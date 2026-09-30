-- =============================================================================
-- Modelo Pro para grupos creados por cualquiera.
--  * Los grupos nuevos son de pago (requires_pro): 1 mes de Pro gratis por
--    persona (una sola vez) y luego 2 €/mes o 20 €/año.
--  * Sólo el "staff" (profiles.can_create_groups = propietario de Winter Arc)
--    tiene acceso gratis a todo y puede activar Pro a quien pague. Crear un
--    grupo ya NO da Pro gratis ni permite regalarlo.
--  * Sin Pro se puede tener 1 grupo propio; con Pro, hasta 10.
-- =============================================================================
alter table public.groups alter column requires_pro set default true;

create or replace function private.is_staff(p_user uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.can_create_groups from public.profiles p where p.id = p_user), false);
$$;

-- Grupos creados por usuarios normales: de pago (los del propietario no cambian).
update public.groups g set requires_pro = true
where not g.requires_pro and not private.is_staff(g.created_by);

create or replace function public.has_full_access(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select not g.requires_pro or private.is_staff((select auth.uid())) or private.is_pro((select auth.uid()))
    from public.groups g where g.id = p_group_id
  ), false);
$$;

-- La prueba empieza al entrar (o crear) el primer grupo de pago; nunca para el staff.
create or replace function private.start_pro_trial()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff(new.user_id)
     and exists (select 1 from public.groups g where g.id = new.group_id and g.requires_pro) then
    insert into private.pro_trials (user_id) values (new.user_id) on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

insert into private.pro_trials (user_id)
select distinct m.user_id
from public.group_members m join public.groups g on g.id = m.group_id
where g.requires_pro and not private.is_staff(m.user_id)
on conflict (user_id) do nothing;

-- Límite de grupos propios: 1 sin Pro, 10 con Pro (el staff sin límite práctico).
create or replace function private.assert_can_create_groups()
returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_owned int;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  if private.is_staff(v_uid) then
    return;
  end if;
  select count(*) into v_owned from public.groups g where g.created_by = v_uid;
  if not private.is_pro(v_uid) and v_owned >= 1 then
    raise exception 'group limit free' using errcode = 'WA402';
  end if;
  if v_owned >= 10 then
    raise exception 'too many groups' using errcode = 'WA429';
  end if;
end $$;

-- ¿Soy staff? (para mostrar el panel de pagos)
create or replace function public.am_i_staff()
returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff((select auth.uid()));
$$;
revoke all on function public.am_i_staff() from public, anon;
grant execute on function public.am_i_staff() to authenticated;

-- Panel de pagos del staff: todos los usuarios con su estado Pro.
create or replace function public.staff_pro_list()
returns table (user_id uuid, display_name text, username text, avatar_emoji text, avatar_color text,
               pro_until timestamptz, trial_until timestamptz, active boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select p.id, p.display_name, p.username, p.avatar_emoji, p.avatar_color,
           case when s.status in ('active', 'trialing', 'past_due') then s.current_period_end end,
           private.pro_trial_end(p.id),
           private.is_pro(p.id)
    from public.profiles p
    left join public.subscriptions s on s.user_id = p.id
    where not private.is_staff(p.id)
    order by p.display_name;
end $$;
revoke all on function public.staff_pro_list() from public, anon;
grant execute on function public.staff_pro_list() to authenticated;

-- Activar/quitar Pro: sólo staff, a cualquier usuario. 1 = mes, 12 = año, 0 = quitar.
create or replace function public.staff_grant_pro(p_user_id uuid, p_months int)
returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_until timestamptz;
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if p_months not in (0, 1, 12) then
    raise exception 'invalid months' using errcode = '22023';
  end if;

  if p_months = 0 then
    update public.subscriptions
       set status = 'canceled', current_period_end = now(), cancel_at_period_end = true, updated_at = now()
     where user_id = p_user_id and paypal_subscription_id is null and stripe_subscription_id is null;
    return null;
  end if;

  if exists (select 1 from public.subscriptions s where s.user_id = p_user_id and s.paypal_subscription_id is not null
             and s.status in ('active', 'past_due') and not s.cancel_at_period_end) then
    raise exception 'already subscribed' using errcode = '22023';
  end if;

  select greatest(
           case when s.status in ('active', 'trialing', 'past_due') then coalesce(s.current_period_end, now()) else now() end,
           coalesce(private.pro_trial_end(p_user_id), now()),
           now()
         ) + make_interval(months => p_months)
    into v_until
    from (select 1) x left join public.subscriptions s on s.user_id = p_user_id;

  insert into public.subscriptions (user_id, provider, status, current_period_end, cancel_at_period_end, updated_at)
  values (p_user_id, 'paypal', 'active', v_until, true, now())
  on conflict (user_id) do update
    set provider = 'paypal', status = 'active', current_period_end = excluded.current_period_end, cancel_at_period_end = true,
        paypal_subscription_id = null, stripe_subscription_id = null, updated_at = now();
  return v_until;
end $$;
revoke all on function public.staff_grant_pro(uuid, int) from public, anon;
grant execute on function public.staff_grant_pro(uuid, int) to authenticated;

-- Las funciones antiguas por sala quedan retiradas (el creador de un grupo ya no puede regalar Pro).
revoke execute on function public.grant_manual_pro(uuid, uuid, int) from authenticated;
revoke execute on function public.group_pro_status(uuid) from authenticated;
