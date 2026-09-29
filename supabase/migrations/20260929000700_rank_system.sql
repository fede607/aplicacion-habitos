-- =============================================================================
-- Winter Arc — sistema de rangos
--  1. habits.weight: dificultad/importancia (1 · 1,5 · 2).
--  2. habit_revisions: historial de la configuración de cada hábito. Los cambios
--     (peso, frecuencia, obligatoriedad, archivado…) nunca reescriben el pasado.
--  3. rank_snapshots: histórico diario del score y rango (no reescribible fuera
--     de la ventana de edición de registros).
-- Todo es aditivo: no se borra ni se modifica ningún dato existente salvo el
-- peso inicial de tres hábitos exigentes de la plantilla.
-- =============================================================================

-- 1. Peso de los hábitos ------------------------------------------------------
alter table public.habits
  add column weight numeric(2, 1) not null default 1.0
  constraint habits_weight_check check (weight in (1.0, 1.5, 2.0));

grant insert (weight), update (weight) on public.habits to authenticated;

-- Pesos iniciales de la plantilla (entrenar, dormir y estudiar son exigentes).
update public.habits
set weight = 1.5
where archived_at is null
  and name in ('Entrenamiento', 'Dormir 7-8 horas', 'Aprendizaje / estudio');

create or replace function private.seed_default_habits(p_group_id uuid, p_starts_on date)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.habits (group_id, name, description, icon, category, color, frequency, weekdays, weekly_target, is_optional, goal, sort_order, starts_on, weight)
  values
    (p_group_id, 'Entrenamiento', 'Fuerza, cardio o deporte: mueve el cuerpo con intensidad.', 'dumbbell', 'physical', '#f97316', 'weekly_target', '{}', 5, false, '45-60 min', 10, p_starts_on, 1.5),
    (p_group_id, 'Despertar temprano', 'Levántate a tu hora objetivo sin posponer la alarma.', 'sun', 'health', '#f59e0b', 'daily', '{}', null, false, 'Antes de las 7:00', 20, p_starts_on, 1.0),
    (p_group_id, 'Ducha fría', 'Termina la ducha con agua fría.', 'snowflake', 'mental', '#38bdf8', 'daily', '{}', null, false, '2-3 min', 30, p_starts_on, 1.0),
    (p_group_id, 'Hidratación', 'Bebe agua a lo largo del día.', 'droplet', 'health', '#0ea5e9', 'daily', '{}', null, false, '2-3 L de agua', 40, p_starts_on, 1.0),
    (p_group_id, 'Alimentación limpia', 'Comida real: sin ultraprocesados, azúcar ni alcohol.', 'apple', 'health', '#22c55e', 'daily', '{}', null, false, 'Cero ultraprocesados', 50, p_starts_on, 1.0),
    (p_group_id, 'Dormir 7-8 horas', 'Descanso de calidad y a una hora constante.', 'bed', 'health', '#6366f1', 'daily', '{}', null, false, '7-8 h', 60, p_starts_on, 1.5),
    (p_group_id, 'Lectura', 'Lee algo que te haga crecer.', 'book-open', 'mental', '#a855f7', 'daily', '{}', null, false, '20 páginas', 70, p_starts_on, 1.0),
    (p_group_id, 'Reflexión diaria', 'Escribe qué hiciste hoy y qué mejorarás mañana.', 'notebook-pen', 'mental', '#ec4899', 'daily', '{}', null, false, '5 min', 80, p_starts_on, 1.0),
    (p_group_id, 'Foco digital', 'Limita redes sociales y pantallas sin propósito.', 'brain', 'mental', '#14b8a6', 'daily', '{}', null, false, 'Máx. 30 min de redes', 90, p_starts_on, 1.0),
    (p_group_id, 'Aprendizaje / estudio', 'Bloque de trabajo profundo en tu objetivo principal.', 'graduation-cap', 'productivity', '#eab308', 'weekdays', '{1,2,3,4,5}', null, false, '1 h de foco', 100, p_starts_on, 1.5);
$$;

revoke execute on function private.seed_default_habits(uuid, date) from public, anon;
grant execute on function private.seed_default_habits(uuid, date) to authenticated;

-- 2. Historial de configuración de hábitos -----------------------------------
create table public.habit_revisions (
  habit_id uuid not null references public.habits (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  effective_from date not null,
  weight numeric(2, 1) not null check (weight in (1.0, 1.5, 2.0)),
  category public.habit_category not null,
  frequency public.habit_frequency not null,
  weekdays smallint[] not null default '{}',
  weekly_target smallint,
  is_optional boolean not null,
  is_active boolean not null,
  archived boolean not null,
  starts_on date not null,
  recorded_at timestamptz not null default now(),
  primary key (habit_id, effective_from)
);
create index habit_revisions_group_idx on public.habit_revisions (group_id);

alter table public.habit_revisions enable row level security;
create policy habit_revisions_select on public.habit_revisions for select to authenticated
  using (private.is_group_member(group_id));
grant select on public.habit_revisions to authenticated;
grant select on public.habit_revisions to service_role;

-- Día local de quien edita (o Madrid si no hay usuario, p. ej. service role).
create or replace function private.editor_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then (now() at time zone 'Europe/Madrid')::date
    else private.user_today((select auth.uid()))
  end;
$$;

/*
 * Registra una versión cada vez que cambia algo que afecta al cálculo.
 *  - Alta de hábito: versión base (1970-01-01); `starts_on` decide desde cuándo cuenta.
 *  - Activar/desactivar/archivar: efectivo HOY (ya no se puede registrar).
 *  - Resto (peso, frecuencia, opcional, categoría, fecha de inicio): efectivo
 *    MAÑANA, para que ni hoy ni el pasado se recalculen con la configuración nueva.
 *  - Un hábito creado hoy o que aún no ha empezado se corrige en su versión base.
 */
create or replace function private.record_habit_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.editor_today();
  v_effective date;
begin
  if tg_op = 'UPDATE' and (
    new.weight, new.category, new.frequency, new.weekdays, new.weekly_target,
    new.is_optional, new.is_active, (new.archived_at is not null), new.starts_on
  ) is not distinct from (
    old.weight, old.category, old.frequency, old.weekdays, old.weekly_target,
    old.is_optional, old.is_active, (old.archived_at is not null), old.starts_on
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' or old.starts_on > v_today or old.created_at > now() - interval '1 day' then
    v_effective := date '1970-01-01';
  elsif new.is_active is distinct from old.is_active
     or (new.archived_at is null) is distinct from (old.archived_at is null) then
    v_effective := v_today;
  else
    v_effective := v_today + 1;
  end if;

  insert into public.habit_revisions (
    habit_id, group_id, effective_from, weight, category, frequency, weekdays,
    weekly_target, is_optional, is_active, archived, starts_on
  ) values (
    new.id, new.group_id, v_effective, new.weight, new.category, new.frequency, new.weekdays,
    new.weekly_target, new.is_optional, new.is_active, new.archived_at is not null, new.starts_on
  )
  on conflict (habit_id, effective_from) do update set
    weight = excluded.weight,
    category = excluded.category,
    frequency = excluded.frequency,
    weekdays = excluded.weekdays,
    weekly_target = excluded.weekly_target,
    is_optional = excluded.is_optional,
    is_active = excluded.is_active,
    archived = excluded.archived,
    starts_on = excluded.starts_on,
    recorded_at = now();
  return new;
end;
$$;

create trigger habits_record_revision after insert or update on public.habits
  for each row execute function private.record_habit_revision();

-- Versión base de los hábitos existentes (y, si estaban archivados, su archivado).
insert into public.habit_revisions (
  habit_id, group_id, effective_from, weight, category, frequency, weekdays,
  weekly_target, is_optional, is_active, archived, starts_on
)
select h.id, h.group_id, date '1970-01-01', h.weight, h.category, h.frequency, h.weekdays,
  h.weekly_target, h.is_optional, h.is_active or h.archived_at is not null, false, h.starts_on
from public.habits h
on conflict do nothing;

insert into public.habit_revisions (
  habit_id, group_id, effective_from, weight, category, frequency, weekdays,
  weekly_target, is_optional, is_active, archived, starts_on
)
select h.id, h.group_id, (h.archived_at at time zone 'Europe/Madrid')::date, h.weight, h.category, h.frequency,
  h.weekdays, h.weekly_target, h.is_optional, false, true, h.starts_on
from public.habits h
where h.archived_at is not null
on conflict do nothing;

-- 3. Histórico de rangos -----------------------------------------------------
create table public.rank_snapshots (
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  snapshot_date date not null,
  daily_score numeric(5, 2) check (daily_score between 0 and 100),
  discipline_score numeric(5, 2) not null check (discipline_score between 0 and 100),
  tier_index smallint not null check (tier_index between 0 and 24),
  phase text not null check (phase in ('provisional', 'estimated', 'stabilizing', 'stable')),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  consistency numeric(5, 2) check (consistency between 0 and 100),
  category_scores jsonb not null default '{}'::jsonb,
  components jsonb not null default '{}'::jsonb,
  inputs jsonb not null default '{}'::jsonb,
  algorithm_version smallint not null check (algorithm_version > 0),
  computed_at timestamptz not null default now(),
  primary key (user_id, group_id, snapshot_date),
  constraint rank_snapshots_json_size check (
    pg_column_size(category_scores) + pg_column_size(components) + pg_column_size(inputs) < 16384
  )
);
create index rank_snapshots_group_date_idx on public.rank_snapshots (group_id, snapshot_date);

alter table public.rank_snapshots enable row level security;

-- Lectura: el dueño y, si comparte hábitos, su grupo. Escritura: sólo el dueño,
-- sólo días dentro de la ventana de edición (el pasado queda congelado).
create policy rank_snapshots_select on public.rank_snapshots for select to authenticated
  using (private.can_view_member_habits(user_id, group_id));
create policy rank_snapshots_insert on public.rank_snapshots for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_group_member(group_id)
    and snapshot_date between private.user_today(user_id) - (private.log_edit_window_days() + 1)
      and private.user_today(user_id)
  );
create policy rank_snapshots_update on public.rank_snapshots for update to authenticated
  using (
    user_id = (select auth.uid())
    and snapshot_date >= private.user_today(user_id) - (private.log_edit_window_days() + 1)
  )
  with check (
    user_id = (select auth.uid())
    and private.is_group_member(group_id)
    and snapshot_date between private.user_today(user_id) - (private.log_edit_window_days() + 1)
      and private.user_today(user_id)
  );

grant select, insert, update on public.rank_snapshots to authenticated;
grant select on public.rank_snapshots to service_role;
