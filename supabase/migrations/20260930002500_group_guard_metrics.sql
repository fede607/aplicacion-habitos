-- =============================================================================
-- 1) Evita grupos duplicados por doble toque: no se puede crear otro grupo
--    en los 15 s siguientes al anterior.
-- 2) Métricas para el propietario (actividad, pruebas y Pro).
-- =============================================================================
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
  if exists (select 1 from public.groups g where g.created_by = v_uid and g.created_at > now() - interval '15 seconds') then
    raise exception 'group created too fast' using errcode = 'WA429';
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

create or replace function public.staff_metrics()
returns table (
  users integer,
  active_today integer,
  active_7d integer,
  on_trial integer,
  trials_ending_7d integer,
  paid integer,
  lifetime integer,
  free_only integer,
  push_devices integer,
  referrals integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  with u as (
    select p.id,
      private.is_pro_lifetime(p.id) as lt,
      private.free_pro_until(p.id) as free_until,
      (select s.current_period_end from public.subscriptions s
        where s.user_id = p.id and s.status in ('active', 'trialing', 'past_due')) as paid_until
    from public.profiles p
    where not private.is_staff(p.id)
  )
  select
    (select count(*) from u)::int,
    (select count(distinct l.user_id) from public.habit_logs l where l.updated_at > now() - interval '24 hours')::int,
    (select count(distinct l.user_id) from public.habit_logs l where l.updated_at > now() - interval '7 days')::int,
    (select count(*) from u where not lt and free_until > now() and coalesce(paid_until, '-infinity') <= now())::int,
    (select count(*) from u where not lt and free_until between now() and now() + interval '7 days' and coalesce(paid_until, '-infinity') <= now())::int,
    (select count(*) from u where not lt and paid_until > now())::int,
    (select count(*) from u where lt)::int,
    (select count(*) from u where not lt and coalesce(free_until, '-infinity') <= now() and coalesce(paid_until, '-infinity') <= now())::int,
    (select count(*) from public.push_subscriptions)::int,
    (select coalesce(sum(b.referrals), 0) from private.pro_bonus b)::int;
end $$;
revoke all on function public.staff_metrics() from public, anon;
grant execute on function public.staff_metrics() to authenticated;
