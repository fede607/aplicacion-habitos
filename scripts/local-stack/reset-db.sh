#!/usr/bin/env bash
# Resetea la BD del stack local de pruebas y re-aplica todas las migraciones.
# SÓLO para desarrollo/test local. Requiere psql y PG* apuntando al Postgres local.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGOPTIONS="-c client_min_messages=warning" PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-54322}" PGUSER="${PGUSER:-postgres}" PGDATABASE="${PGDATABASE:-postgres}"

psql -q -v ON_ERROR_STOP=1 <<'SQL'
drop trigger if exists on_auth_user_created on auth.users;
truncate auth.users cascade;
drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
SQL

for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -f "$f"
done
psql -q -c "notify pgrst, 'reload schema'"
echo "database reset OK"
