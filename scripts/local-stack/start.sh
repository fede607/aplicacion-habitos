#!/usr/bin/env bash
# Arranca el stack de PRUEBAS sin Docker: Postgres + supabase/auth + PostgREST + gateway/SMTP.
# Requiere: binarios de Postgres (PG_BIN), `auth` y `postgrest` en STACK_DIR (descargados de sus releases).
# Uso: STACK_DIR=/opt/sb PGDATA=/opt/pgdata scripts/local-stack/start.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
STACK_DIR="${STACK_DIR:-/opt/sb}"
PGDATA="${PGDATA:-/opt/pgdata}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PG_USER="${PG_USER:-postgres}"
LOG_DIR="${LOG_DIR:-$STACK_DIR}"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"

run_pg() { if [ "$(id -u)" = 0 ]; then su "$PG_USER" -c "$*"; else bash -c "$*"; fi; }

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA" && chown "$PG_USER" "$PGDATA" 2>/dev/null || true
  run_pg "$PG_BIN/initdb -D $PGDATA -U postgres --auth=trust -E UTF8 >/dev/null"
  FRESH=1
fi
if ! "$PG_BIN/pg_isready" -h 127.0.0.1 -p 54322 -q; then
  run_pg "$PG_BIN/pg_ctl -D $PGDATA -o '-p 54322 -k /tmp' -l $PGDATA/log.txt start >/dev/null"
  until "$PG_BIN/pg_isready" -h 127.0.0.1 -p 54322 -q; do sleep 0.5; done
fi
if [ "${FRESH:-0}" = 1 ]; then
  psql -h 127.0.0.1 -p 54322 -U postgres -q -f "$HERE/bootstrap.sql"
fi

if ! curl -sf http://127.0.0.1:9999/health >/dev/null; then
  (
    cd "$STACK_DIR"
    env GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 \
      GOTRUE_DB_DRIVER=postgres \
      DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:54322/postgres?search_path=auth" \
      GOTRUE_DB_MIGRATIONS_PATH="$STACK_DIR/migrations" GOTRUE_SITE_URL=http://localhost:3000 \
      GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 \
      GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_DISABLE_SIGNUP=false \
      GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_SMTP_HOST=127.0.0.1 \
      GOTRUE_SMTP_PORT=2500 GOTRUE_SMTP_ADMIN_EMAIL=admin@winterarc.local GOTRUE_SMTP_SENDER_NAME=WinterArc \
      GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify \
      GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify \
      GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_LOG_LEVEL=warn \
      nohup ./auth >"$LOG_DIR/auth.log" 2>&1 &
  )
  until curl -sf http://127.0.0.1:9999/health >/dev/null; do sleep 0.5; done
  psql -h 127.0.0.1 -p 54322 -U postgres -q -c "grant usage on schema auth to anon, authenticated, service_role; grant execute on all functions in schema auth to anon, authenticated, service_role;"
fi

if ! curl -sf http://127.0.0.1:3001/ >/dev/null; then
  cat >"$STACK_DIR/pgrst.conf" <<CONF
db-uri = "postgres://authenticator:postgres@127.0.0.1:54322/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 3001
server-host = "127.0.0.1"
db-extra-search-path = "public, extensions"
log-level = "warn"
CONF
  (cd "$STACK_DIR" && nohup ./postgrest pgrst.conf >"$LOG_DIR/pgrst.log" 2>&1 &)
  until curl -sf http://127.0.0.1:3001/ >/dev/null; do sleep 0.5; done
fi

if ! curl -sf http://127.0.0.1:54321/auth/v1/health >/dev/null; then
  (cd "$ROOT" && nohup node scripts/local-stack/gateway.mjs >"$LOG_DIR/gw.log" 2>&1 &)
  until curl -sf http://127.0.0.1:54321/auth/v1/health >/dev/null; do sleep 0.5; done
fi
echo "local stack ready: http://127.0.0.1:54321"
