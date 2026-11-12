-- Plazas limitadas de lanzamiento: 90 cuentas nuevas a partir de las que ya existían.
-- El límite es real (se aplica en el alta), no sólo un texto de la portada.
insert into private.app_settings (key, value)
select 'signup_spots_total', '90'
where not exists (select 1 from private.app_settings where key = 'signup_spots_total');

insert into private.app_settings (key, value)
select 'signup_spots_base', (select count(*)::text from public.profiles)
where not exists (select 1 from private.app_settings where key = 'signup_spots_base');

-- Plazas libres (null = sin límite).
create or replace function private.signup_spots_left()
returns integer
language sql
stable security definer
set search_path to ''
as $$
  select case when t.total is null then null
    else greatest(0, t.total - greatest(0, (select count(*) from public.profiles)::int - coalesce(b.base, 0))) end
  from (select (select nullif(value, '')::int from private.app_settings where key = 'signup_spots_total') as total) t,
       (select (select nullif(value, '')::int from private.app_settings where key = 'signup_spots_base') as base) b;
$$;

-- Para la web pública: total de plazas y cuántas quedan (sin filas = sin límite).
create or replace function public.signup_spots()
returns table (total integer, spots_left integer)
language sql
stable security definer
set search_path to ''
as $$
  select (select value::int from private.app_settings where key = 'signup_spots_total'), private.signup_spots_left()
  where private.signup_spots_left() is not null;
$$;
revoke all on function public.signup_spots() from public;
grant execute on function public.signup_spots() to anon, authenticated, service_role;

-- En el alta pública (sin invitación ni lista blanca): si no quedan plazas, no se crea la cuenta.
do $do$
declare
  v_def text := pg_catalog.pg_get_functiondef('private.handle_new_user'::regproc);
  v_old text := 'perform pg_catalog.pg_advisory_xact_lock(hashtext(''winter_arc_bootstrap_signup''));';
  v_new text := 'perform pg_catalog.pg_advisory_xact_lock(hashtext(''winter_arc_bootstrap_signup''));
    if not private.invite_only() and coalesce(private.signup_spots_left(), 1) <= 0
       and not exists (select 1 from private.signup_allowlist a where a.email = lower(new.email)) then
      raise exception ''signup full'' using errcode = ''WA429'';
    end if;';
begin
  if position('signup full' in v_def) > 0 then return; end if;
  if position(v_old in v_def) = 0 then
    raise exception 'handle_new_user: no se encuentra la línea a parchear';
  end if;
  execute replace(v_def, v_old, v_new);
end;
$do$;
