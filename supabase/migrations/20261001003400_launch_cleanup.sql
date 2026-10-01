-- Lanzamiento: las funciones de duelos ya no se usan en la app; nadie puede llamarlas.
-- (Se dejan definidas; las tablas se conservan intactas.)
revoke execute on function public.create_duel(uuid, uuid, date), public.respond_duel(uuid, boolean), public.cancel_duel(uuid) from public, anon, authenticated;
