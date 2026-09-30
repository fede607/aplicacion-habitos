-- =============================================================================
-- Cualquier usuario puede crear su propio grupo y compartir su código.
--  * Límite anti-abuso: máximo 10 grupos creados por persona (y 5 al día, ya
--    existente en create_group).
--  * El código que se genera al crear el grupo no caduca (se puede revocar o
--    regenerar desde Administrar).
-- =============================================================================
create or replace function private.assert_can_create_groups()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  if (select count(*) from public.groups g where g.created_by = auth.uid()) >= 10 then
    raise exception 'too many groups' using errcode = 'WA429';
  end if;
end;
$$;

create or replace function public.create_group(
  p_name text,
  p_description text default '',
  p_start_date date default null,
  p_end_date date default null,
  p_seed_defaults boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_start date := coalesce(p_start_date, private.user_today(auth.uid()));
  v_end date := coalesce(p_end_date, coalesce(p_start_date, private.user_today(auth.uid())) + 90);
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
$$;
