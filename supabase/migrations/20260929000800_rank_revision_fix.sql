-- =============================================================================
-- Rangos: corrección del historial de versiones de hábitos.
-- Activar/desactivar/archivar (efectivo hoy) ya no arrastra a hoy cambios de
-- configuración pendientes para mañana, y se propaga a las versiones futuras.
-- =============================================================================
create or replace function private.record_habit_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.editor_today();
  v_archived boolean := new.archived_at is not null;
  v_cfg_changed boolean;
  v_state_changed boolean;
begin
  if tg_op = 'UPDATE' then
    v_cfg_changed := (new.weight, new.category, new.frequency, new.weekdays, new.weekly_target, new.is_optional, new.starts_on)
      is distinct from (old.weight, old.category, old.frequency, old.weekdays, old.weekly_target, old.is_optional, old.starts_on);
    v_state_changed := (new.is_active, v_archived) is distinct from (old.is_active, old.archived_at is not null);
    if not v_cfg_changed and not v_state_changed then
      return new;
    end if;
  end if;

  -- Alta, hábito recién creado (< 24 h) o que aún no ha empezado: no hay pasado
  -- que proteger, la configuración nueva vale para todas sus versiones.
  if tg_op = 'INSERT' or old.starts_on > v_today or old.created_at > now() - interval '1 day' then
    insert into public.habit_revisions (
      habit_id, group_id, effective_from, weight, category, frequency, weekdays,
      weekly_target, is_optional, is_active, archived, starts_on
    ) values (
      new.id, new.group_id, date '1970-01-01', new.weight, new.category, new.frequency, new.weekdays,
      new.weekly_target, new.is_optional, new.is_active, v_archived, new.starts_on
    )
    on conflict (habit_id, effective_from) do nothing;
    update public.habit_revisions set
      weight = new.weight, category = new.category, frequency = new.frequency, weekdays = new.weekdays,
      weekly_target = new.weekly_target, is_optional = new.is_optional, is_active = new.is_active,
      archived = v_archived, starts_on = new.starts_on, recorded_at = now()
    where habit_id = new.id;
    return new;
  end if;

  -- Activar/desactivar/archivar: desde hoy, sobre la configuración vigente hoy.
  if v_state_changed then
    insert into public.habit_revisions (
      habit_id, group_id, effective_from, weight, category, frequency, weekdays,
      weekly_target, is_optional, is_active, archived, starts_on
    )
    select new.id, new.group_id, v_today,
      coalesce(r.weight, old.weight), coalesce(r.category, old.category), coalesce(r.frequency, old.frequency),
      coalesce(r.weekdays, old.weekdays), case when r.habit_id is null then old.weekly_target else r.weekly_target end,
      coalesce(r.is_optional, old.is_optional), new.is_active, v_archived, coalesce(r.starts_on, old.starts_on)
    from (select 1) one
    left join lateral (
      select * from public.habit_revisions x
      where x.habit_id = new.id and x.effective_from <= v_today
      order by x.effective_from desc limit 1
    ) r on true
    on conflict (habit_id, effective_from) do update set
      is_active = excluded.is_active, archived = excluded.archived, recorded_at = now();

    update public.habit_revisions
    set is_active = new.is_active, archived = v_archived, recorded_at = now()
    where habit_id = new.id and effective_from > v_today;
  end if;

  -- Peso, frecuencia, obligatoriedad, categoría o inicio: desde mañana.
  if v_cfg_changed then
    insert into public.habit_revisions (
      habit_id, group_id, effective_from, weight, category, frequency, weekdays,
      weekly_target, is_optional, is_active, archived, starts_on
    ) values (
      new.id, new.group_id, v_today + 1, new.weight, new.category, new.frequency, new.weekdays,
      new.weekly_target, new.is_optional, new.is_active, v_archived, new.starts_on
    )
    on conflict (habit_id, effective_from) do update set
      weight = excluded.weight, category = excluded.category, frequency = excluded.frequency,
      weekdays = excluded.weekdays, weekly_target = excluded.weekly_target, is_optional = excluded.is_optional,
      is_active = excluded.is_active, archived = excluded.archived, starts_on = excluded.starts_on,
      recorded_at = now();
  end if;
  return new;
end;
$$;
