-- =============================================================================
-- Interruptor de pagos (staff). Con los pagos cerrados, Pro es gratis para todos
-- y la web no muestra precios. Al abrirlos, cada usuario recibe 1 mes de Pro
-- gratis desde ese día para que nadie pierda nada de golpe.
-- =============================================================================
insert into private.app_settings (key, value) values ('payments_open', 'false')
on conflict (key) do update set value = 'false', updated_at = now();

create or replace function private.payments_open() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true' from private.app_settings where key = 'payments_open'), false);
$$;

create or replace function public.payments_open() returns boolean
language sql stable security definer set search_path = '' as $$ select private.payments_open() $$;

create or replace function private.is_pro(p_user uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select not private.payments_open()
    or private.is_pro_lifetime(p_user)
    or exists (
      select 1 from public.subscriptions s
      where s.user_id = p_user
        and s.status in ('active', 'trialing', 'past_due')
        and (s.current_period_end is null or s.current_period_end > now() - interval '3 days')
    )
    or coalesce(private.free_pro_until(p_user) > now(), false);
$function$;

create or replace function public.staff_set_payments_open(p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_on and not private.payments_open() then
    insert into private.pro_bonus (user_id, until)
    select p.id, now() + interval '1 month' from public.profiles p
    on conflict (user_id) do update set until = greatest(private.pro_bonus.until, excluded.until);
  end if;
  insert into private.app_settings (key, value) values ('payments_open', case when p_on then 'true' else 'false' end)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

revoke all on function public.payments_open(), public.staff_set_payments_open(boolean) from public, anon, authenticated;
grant execute on function public.payments_open() to anon, authenticated;
grant execute on function public.staff_set_payments_open(boolean) to authenticated;
