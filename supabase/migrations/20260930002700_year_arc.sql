-- Year Arc: el reto dura todo el año (365 días) en vez de 90.
alter table public.groups alter column end_date set default (current_date + 365);

create or replace function public.create_group(p_name text, p_description text default ''::text, p_start_date date default null::date, p_end_date date default null::date, p_seed_defaults boolean default true)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_start date := coalesce(p_start_date, private.user_today(auth.uid()));
  v_end date := coalesce(p_end_date, coalesce(p_start_date, private.user_today(auth.uid())) + 365);
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  perform private.assert_can_create_groups();
  perform private.check_rate_limit('group_create:' || v_uid::text, 5, interval '1 day');

  insert into public.groups (name, description, start_date, end_date, created_by)
  values (btrim(p_name), coalesce(p_description, ''), v_start, v_end, v_uid)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role) values (v_group_id, v_uid, 'admin');

  if p_seed_defaults then
    perform private.seed_default_habits(v_group_id, v_start);
  end if;

  insert into public.group_invitations (group_id, code, created_by, expires_at)
  values (v_group_id, private.generate_invite_code(), v_uid, null);

  update public.user_settings set active_group_id = v_group_id where user_id = v_uid;
  return v_group_id;
end;
$function$;

-- Los grupos existentes pasan a durar un año completo.
update public.groups set end_date = start_date + 365 where end_date < start_date + 365;
