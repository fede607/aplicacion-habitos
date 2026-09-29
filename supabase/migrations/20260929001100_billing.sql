-- =============================================================================
-- Winter Arc Pro (Stripe)
--  * groups.requires_pro: sala de pago. Sin Pro sólo se ven los hábitos del día.
--  * subscriptions: estado de la suscripción de cada usuario. SÓLO lo escribe el
--    servidor (webhook de Stripe con service role); el usuario sólo lee la suya.
--    Nunca se guardan datos de tarjeta: el pago ocurre en Stripe Checkout.
--  * private.billing_config: secreto del webhook creado automáticamente.
-- =============================================================================
alter table public.groups add column requires_pro boolean not null default false;

-- La sala de la clase es de pago; el grupo de amigos sigue gratis.
update public.groups set requires_pro = true where id = '510be197-638a-4e21-bcda-26532aa26aa3';

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy subscriptions_select_own on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;

create table private.billing_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table private.billing_config enable row level security;

-- Sólo el servidor (service role) guarda/lee el secreto del webhook.
create or replace function public.billing_config_get(p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select value from private.billing_config where key = p_key $$;

create or replace function public.billing_config_set(p_key text, p_value text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.billing_config (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
$$;

revoke execute on function public.billing_config_get(text), public.billing_config_set(text, text) from public, anon, authenticated;
grant execute on function public.billing_config_get(text), public.billing_config_set(text, text) to service_role;

-- ¿Tiene el usuario Pro activo?
create or replace function private.is_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user
      and s.status in ('active', 'trialing', 'past_due')
      and (s.current_period_end is null or s.current_period_end > now() - interval '3 days')
  );
$$;

-- Acceso completo a un grupo: gratis, creador del grupo, o Pro.
create or replace function public.has_full_access(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select not g.requires_pro or g.created_by = (select auth.uid()) or private.is_pro((select auth.uid()))
    from public.groups g where g.id = p_group_id
  ), false);
$$;
revoke execute on function public.has_full_access(uuid) from public, anon;
grant execute on function public.has_full_access(uuid) to authenticated;

-- Los duelos también son Pro en salas de pago (validado en la BD, no sólo en la UI).
create or replace function private.assert_full_access(p_group_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_full_access(p_group_id) then
    raise exception 'pro required' using errcode = 'WA402';
  end if;
end;
$$;

create or replace function private.duels_require_pro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_full_access(new.group_id);
  return new;
end;
$$;
create trigger duels_require_pro before insert on public.duels
  for each row execute function private.duels_require_pro();
