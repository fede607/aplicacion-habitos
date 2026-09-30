-- =============================================================================
-- Pro para siempre para Miky (@elcboomcatalan) y Saavedra (@saavedrixx).
-- El resto: 1 mes de prueba y después la versión gratis (Pro, pagando).
-- Todos los grupos pasan a ser de pago; el propietario (staff) conserva todo.
-- =============================================================================
create table if not exists private.pro_lifetime (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);
revoke all on private.pro_lifetime from public, anon, authenticated;

insert into private.pro_lifetime (user_id)
select p.id from public.profiles p where p.username in ('elcboomcatalan', 'saavedrixx')
on conflict (user_id) do nothing;

create or replace function private.is_pro_lifetime(p_user uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.pro_lifetime l where l.user_id = p_user);
$$;

create or replace function private.is_pro(p_user uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_pro_lifetime(p_user)
    or exists (
      select 1 from public.subscriptions s
      where s.user_id = p_user
        and s.status in ('active', 'trialing', 'past_due')
        and (s.current_period_end is null or s.current_period_end > now() - interval '3 days')
    )
    or coalesce(private.pro_trial_end(p_user) > now(), false);
$$;

-- Todos los grupos de pago.
update public.groups set requires_pro = true where not requires_pro;

-- Quien aún no tenía prueba (p. ej. los de grupos que eran gratis) la empieza hoy.
insert into private.pro_trials (user_id)
select distinct m.user_id from public.group_members m
where not private.is_staff(m.user_id) and not private.is_pro_lifetime(m.user_id)
on conflict (user_id) do nothing;

create or replace function public.my_pro_lifetime()
returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_pro_lifetime((select auth.uid()));
$$;
revoke all on function public.my_pro_lifetime() from public, anon;
grant execute on function public.my_pro_lifetime() to authenticated;

drop function if exists public.staff_pro_list();
create function public.staff_pro_list()
returns table (user_id uuid, display_name text, username text, avatar_emoji text, avatar_color text,
               pro_until timestamptz, trial_until timestamptz, active boolean, lifetime boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select p.id, p.display_name, p.username, p.avatar_emoji, p.avatar_color,
           case when s.status in ('active', 'trialing', 'past_due') then s.current_period_end end,
           private.pro_trial_end(p.id),
           private.is_pro(p.id),
           private.is_pro_lifetime(p.id)
    from public.profiles p
    left join public.subscriptions s on s.user_id = p.id
    where not private.is_staff(p.id)
    order by p.display_name;
end $$;
revoke all on function public.staff_pro_list() from public, anon;
grant execute on function public.staff_pro_list() to authenticated;
