-- La IA del plan se descartó: se elimina el contador de uso (nunca llegó a usarse).
drop function if exists public.ai_consume();
drop table if exists private.ai_usage;
