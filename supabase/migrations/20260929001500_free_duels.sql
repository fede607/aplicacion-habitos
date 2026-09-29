-- =============================================================================
-- Sin Pro también se puede entrar al grupo y hacer duelos. Pro queda para
-- panel, calendario, progreso, rango y entrenamientos.
-- =============================================================================
drop trigger if exists duels_require_pro on public.duels;
drop function if exists private.duels_require_pro();
