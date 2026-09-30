-- =============================================================================
-- Registro abierto (campañas en redes/WhatsApp): cualquiera puede crear cuenta
-- y su propio grupo. Protecciones: límite por IP y global en la Edge Function
-- y origen de la campaña para medir qué funciona.
-- =============================================================================
create table if not exists private.signup_sources (
  user_id uuid primary key references auth.users (id) on delete cascade,
  source text not null check (source ~ '^[a-z0-9_-]{1,32}$'),
  created_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(regexp_replace(coalesce(v_meta ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'));
  v_display text := left(btrim(coalesce(nullif(v_meta ->> 'display_name', ''), nullif(v_meta ->> 'full_name', ''), v_meta ->> 'name', '')), 40);
  v_tz text := coalesce(v_meta ->> 'timezone', 'Europe/Madrid');
  v_code text := private.normalize_invite_code(v_meta ->> 'invite_code');
  v_source text := lower(left(regexp_replace(coalesce(v_meta ->> 'signup_source', ''), '[^a-zA-Z0-9_-]', '', 'g'), 32));
  v_inv public.group_invitations;
  v_creator boolean := false;
begin
  if v_code <> '' then
    select * into v_inv from public.group_invitations where code = v_code for update;
    if private.invitation_state(v_inv) <> 'valid' then
      raise exception 'invalid invitation' using errcode = 'WA404';
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(hashtext('winter_arc_bootstrap_signup'));
    -- Sólo el primer usuario o los de la lista blanca son staff. El resto se
    -- registra libremente como usuario normal (crea o se une a un grupo después).
    if not exists (select 1 from public.profiles)
       or exists (select 1 from private.signup_allowlist a where a.email = lower(new.email)) then
      v_creator := true;
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

  if v_source <> '' then
    insert into private.signup_sources (user_id, source) values (new.id, v_source) on conflict do nothing;
  elsif v_inv.id is not null then
    insert into private.signup_sources (user_id, source) values (new.id, 'invitacion') on conflict do nothing;
  end if;

  if v_inv.id is not null then
    insert into public.group_members (group_id, user_id, role) values (v_inv.group_id, new.id, 'member');
    update public.group_invitations set use_count = use_count + 1 where id = v_inv.id;
    perform private.reward_referral(v_inv.created_by, new.id);
  end if;
  return new;
end;
$function$;

-- Límite de altas: 5 por IP y hora, 300 en total por hora. Sólo lo llama la Edge Function (service_role).
create or replace function public.signup_rate_check(p_ip text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_rate_limit('signup_ip:' || left(coalesce(p_ip, 'unknown'), 64), 5, interval '1 hour');
  perform private.check_rate_limit('signup_global', 300, interval '1 hour');
end $$;
revoke all on function public.signup_rate_check(text) from public, anon, authenticated;
grant execute on function public.signup_rate_check(text) to service_role;

-- Staff: altas por origen (últimos 30 días y total).
create or replace function public.staff_signup_sources()
returns table (source text, last_30d int, total int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select coalesce(s.source, 'directo'),
    count(*) filter (where p.created_at > now() - interval '30 days')::int,
    count(*)::int
  from public.profiles p left join private.signup_sources s on s.user_id = p.id
  where not private.is_staff(p.id)
  group by 1
  order by 2 desc, 3 desc;
end $$;
revoke all on function public.staff_signup_sources() from public, anon;
grant execute on function public.staff_signup_sources() to authenticated;
