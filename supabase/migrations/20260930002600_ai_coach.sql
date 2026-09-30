-- =============================================================================
-- Coach IA: límite de preguntas por persona y día (controla el coste de la API).
-- 25/día por usuario; 200/día para el propietario. Se reinicia a medianoche UTC.
-- =============================================================================
create table if not exists private.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (user_id, day)
);
revoke all on private.ai_usage from public, anon, authenticated;

-- Consume 1 pregunta. Devuelve cuántas quedan hoy (>= 0) o -1 si ya no quedan.
create or replace function public.ai_consume()
returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_limit int;
  v_count int;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  v_limit := case when private.is_staff(v_uid) then 200 else 25 end;
  insert into private.ai_usage as u (user_id, day, count)
  values (v_uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = u.count + 1
  where u.count < v_limit
  returning u.count into v_count;
  if v_count is null then
    return -1;
  end if;
  delete from private.ai_usage where day < (now() at time zone 'utc')::date - 30;
  return v_limit - v_count;
end $$;
revoke all on function public.ai_consume() from public, anon;
grant execute on function public.ai_consume() to authenticated;
