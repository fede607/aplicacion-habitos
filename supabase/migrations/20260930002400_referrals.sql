-- =============================================================================
-- Invita y gana: cada amigo NUEVO que se registra con tu invitación os da
-- +7 días de Pro a los dos (máximo 10 amigos premiados por persona).
-- Los días se suman al final del Pro que ya tengáis (prueba, pago o bonus).
-- =============================================================================
create table if not exists private.pro_bonus (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz not null default now(),
  referrals integer not null default 0
);
revoke all on private.pro_bonus from public, anon, authenticated;

-- Pro gratis (prueba + bonus) hasta esta fecha.
create or replace function private.free_pro_until(p_user uuid)
returns timestamptz
language sql stable security definer set search_path = '' as $$
  select nullif(greatest(
    coalesce(private.pro_trial_end(p_user), '-infinity'::timestamptz),
    coalesce((select b.until from private.pro_bonus b where b.user_id = p_user), '-infinity'::timestamptz)
  ), '-infinity'::timestamptz);
$$;

create or replace function private.add_bonus_days(p_user uuid, p_days int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_paid timestamptz;
begin
  if p_user is null or private.is_staff(p_user) or private.is_pro_lifetime(p_user) then
    return;
  end if;
  select case when s.status in ('active', 'trialing', 'past_due') then s.current_period_end end into v_paid
  from public.subscriptions s where s.user_id = p_user;
  insert into private.pro_bonus as b (user_id, until)
  values (p_user, greatest(now(), coalesce(private.free_pro_until(p_user), now()), coalesce(v_paid, now())) + make_interval(days => p_days))
  on conflict (user_id) do update
    set until = greatest(now(), coalesce(private.free_pro_until(p_user), now()), coalesce(v_paid, now())) + make_interval(days => p_days);
end $$;

create or replace function private.reward_referral(p_inviter uuid, p_new_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  if p_inviter is null or p_inviter = p_new_user then
    return;
  end if;
  select coalesce((select b.referrals from private.pro_bonus b where b.user_id = p_inviter), 0) into v_count;
  if v_count >= 10 then
    return;
  end if;
  perform private.add_bonus_days(p_inviter, 7);
  insert into private.pro_bonus as b (user_id, until, referrals) values (p_inviter, now(), 1)
  on conflict (user_id) do update set referrals = b.referrals + 1;
  perform private.add_bonus_days(p_new_user, 7);
end $$;

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
    or coalesce(private.free_pro_until(p_user) > now(), false);
$$;

-- La app muestra la prueba + bonus como "Pro gratis hasta".
create or replace function public.my_pro_trial_end()
returns timestamptz
language sql stable security definer set search_path = '' as $$
  select private.free_pro_until((select auth.uid()));
$$;

create or replace function public.my_referral_status()
returns table (referrals integer, bonus_until timestamptz)
language sql stable security definer set search_path = '' as $$
  select coalesce(b.referrals, 0), b.until
  from (select (select auth.uid()) as uid) me
  left join private.pro_bonus b on b.user_id = me.uid;
$$;
revoke all on function public.my_referral_status() from public, anon;
grant execute on function public.my_referral_status() to authenticated;

-- Panel del propietario: "gratis hasta" incluye el bonus.
create or replace function public.staff_pro_list()
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
           private.free_pro_until(p.id),
           private.is_pro(p.id),
           private.is_pro_lifetime(p.id)
    from public.profiles p
    left join public.subscriptions s on s.user_id = p.id
    where not private.is_staff(p.id)
    order by p.display_name;
end $$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(regexp_replace(coalesce(v_meta ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'));
  v_display text := left(btrim(coalesce(nullif(v_meta ->> 'display_name', ''), nullif(v_meta ->> 'full_name', ''), v_meta ->> 'name', '')), 40);
  v_tz text := coalesce(v_meta ->> 'timezone', 'Europe/Madrid');
  v_code text := private.normalize_invite_code(v_meta ->> 'invite_code');
  v_inv public.group_invitations;
  v_creator boolean := false;
begin
  if v_code <> '' then
    select * into v_inv from public.group_invitations where code = v_code for update;
    if private.invitation_state(v_inv) <> 'valid' then
      raise exception 'invalid invitation' using errcode = 'WA404';
    end if;
  else
    -- Serializa el alta sin invitación para que sólo haya UNA primera cuenta.
    perform pg_catalog.pg_advisory_xact_lock(hashtext('winter_arc_bootstrap_signup'));
    if not exists (select 1 from public.profiles)
       or exists (select 1 from private.signup_allowlist a where a.email = lower(new.email)) then
      v_creator := true;
    elsif coalesce(new.raw_app_meta_data ->> 'provider', '') in ('google', 'apple') then
      -- Google/Apple no pueden enviar el código: la cuenta se crea sin grupo y
      -- /auth/callback la une con la invitación guardada en cookie o la borra
      -- en el acto si no hay invitación válida (sigue siendo sólo por invitación).
      null;
    else
      raise exception 'invitation required' using errcode = 'WA403';
    end if;
  end if;

  if v_username !~ '^[a-z0-9_]{3,24}$'
     or exists (select 1 from public.profiles where username = v_username) then
    v_username := 'user_' || encode(extensions.gen_random_bytes(5), 'hex');
  end if;
  if v_display = '' then
    v_display := v_username;
  end if;
  if not private.is_valid_timezone(v_tz) then
    v_tz := 'Europe/Madrid';
  end if;

  insert into public.profiles (id, username, display_name, timezone, can_create_groups)
  values (new.id, v_username, v_display, v_tz, v_creator);
  insert into public.user_settings (user_id, active_group_id) values (new.id, v_inv.group_id);

  if v_inv.id is not null then
    insert into public.group_members (group_id, user_id, role) values (v_inv.group_id, new.id, 'member');
    update public.group_invitations set use_count = use_count + 1 where id = v_inv.id;
    -- Recompensa por invitar: +7 días de Pro para quien invita y para el nuevo.
    perform private.reward_referral(v_inv.created_by, new.id);
  end if;
  return new;
end;
$$;

-- Un pago se suma al final del Pro gratis (prueba + bonus).
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
           coalesce(private.free_pro_until(p_user_id), now()),
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
