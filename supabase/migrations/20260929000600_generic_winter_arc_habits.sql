-- =============================================================================
-- Winter Arc — plantilla de hábitos genérica
-- Sustituye la plantilla inicial por los hábitos clásicos de un Winter Arc,
-- válidos para cualquier grupo. Cada admin puede editarlos desde la app.
-- =============================================================================

create or replace function private.seed_default_habits(p_group_id uuid, p_starts_on date)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.habits (group_id, name, description, icon, category, color, frequency, weekdays, weekly_target, is_optional, goal, sort_order, starts_on)
  values
    (p_group_id, 'Entrenamiento', 'Fuerza, cardio o deporte: mueve el cuerpo con intensidad.', 'dumbbell', 'physical', '#f97316', 'weekly_target', '{}', 5, false, '45-60 min', 10, p_starts_on),
    (p_group_id, 'Despertar temprano', 'Levántate a tu hora objetivo sin posponer la alarma.', 'sun', 'health', '#f59e0b', 'daily', '{}', null, false, 'Antes de las 7:00', 20, p_starts_on),
    (p_group_id, 'Ducha fría', 'Termina la ducha con agua fría.', 'snowflake', 'mental', '#38bdf8', 'daily', '{}', null, false, '2-3 min', 30, p_starts_on),
    (p_group_id, 'Hidratación', 'Bebe agua a lo largo del día.', 'droplet', 'health', '#0ea5e9', 'daily', '{}', null, false, '2-3 L de agua', 40, p_starts_on),
    (p_group_id, 'Alimentación limpia', 'Comida real: sin ultraprocesados, azúcar ni alcohol.', 'apple', 'health', '#22c55e', 'daily', '{}', null, false, 'Cero ultraprocesados', 50, p_starts_on),
    (p_group_id, 'Dormir 7-8 horas', 'Descanso de calidad y a una hora constante.', 'bed', 'health', '#6366f1', 'daily', '{}', null, false, '7-8 h', 60, p_starts_on),
    (p_group_id, 'Lectura', 'Lee algo que te haga crecer.', 'book-open', 'mental', '#a855f7', 'daily', '{}', null, false, '20 páginas', 70, p_starts_on),
    (p_group_id, 'Reflexión diaria', 'Escribe qué hiciste hoy y qué mejorarás mañana.', 'notebook-pen', 'mental', '#ec4899', 'daily', '{}', null, false, '5 min', 80, p_starts_on),
    (p_group_id, 'Foco digital', 'Limita redes sociales y pantallas sin propósito.', 'brain', 'mental', '#14b8a6', 'daily', '{}', null, false, 'Máx. 30 min de redes', 90, p_starts_on),
    (p_group_id, 'Aprendizaje / estudio', 'Bloque de trabajo profundo en tu objetivo principal.', 'graduation-cap', 'productivity', '#eab308', 'weekdays', '{1,2,3,4,5}', null, false, '1 h de foco', 100, p_starts_on);
$$;

revoke execute on function private.seed_default_habits(uuid, date) from public, anon;
grant execute on function private.seed_default_habits(uuid, date) to authenticated;
