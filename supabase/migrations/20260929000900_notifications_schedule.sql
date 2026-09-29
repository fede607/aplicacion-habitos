-- =============================================================================
-- Avisos por email: disparador horario desde la propia BD (pg_cron + pg_net).
-- El secreto NO está aquí: se guarda en Vault con el nombre
-- 'notifications_cron_secret' (mismo valor que CRON_SECRET en Vercel):
--   select vault.create_secret('<secreto>', 'notifications_cron_secret');
-- =============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function private.trigger_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notifications_cron_secret' limit 1;
  if v_secret is null then
    return;
  end if;
  perform net.http_get(
    url := 'https://winterarc-2026.vercel.app/api/cron/notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function private.trigger_notifications() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'winter-arc-notifications';
select cron.schedule('winter-arc-notifications', '7 * * * *', 'select private.trigger_notifications()');

-- Recordatorio diario activado por defecto (cada email trae enlace de baja y
-- se desactiva en Ajustes). Sólo se envía si quedan hábitos pendientes.
alter table public.user_settings alter column email_daily_reminder set default true;
update public.user_settings set email_daily_reminder = true, email_weekly_summary = true;
