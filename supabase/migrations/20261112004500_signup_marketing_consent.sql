-- Consentimiento de novedades y ofertas en el registro (casilla opcional, desmarcada por defecto).
-- Se guarda cuándo se dio el consentimiento para poder acreditarlo (RGPD/LSSI).
alter table public.user_settings add column if not exists marketing_consent_at timestamptz;

create or replace function private.stamp_marketing_consent()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.marketing_push and (tg_op = 'INSERT' or not old.marketing_push) then
    new.marketing_consent_at := now();
  elsif not new.marketing_push then
    new.marketing_consent_at := null;
  end if;
  return new;
end;
$$;

create or replace trigger user_settings_marketing_consent
before insert or update of marketing_push on public.user_settings
for each row execute function private.stamp_marketing_consent();

update public.user_settings set marketing_consent_at = updated_at where marketing_push and marketing_consent_at is null;

-- Al crear la cuenta: si marcó la casilla en el registro, nace con las novedades activadas.
-- Se parchea la línea del alta en handle_new_user (el resto de la función queda igual).
do $do$
declare
  v_def text := pg_catalog.pg_get_functiondef('private.handle_new_user'::regproc);
  v_old text := 'insert into public.user_settings (user_id, active_group_id) values (new.id, v_active);';
  v_new text := 'insert into public.user_settings (user_id, active_group_id, marketing_push) values (new.id, v_active, coalesce(v_meta ->> ''marketing_opt_in'', '''') = ''true'');';
begin
  if position(v_old in v_def) = 0 then
    raise exception 'handle_new_user: no se encuentra la línea a parchear';
  end if;
  execute replace(v_def, v_old, v_new);
end;
$do$;
