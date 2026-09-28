# Uso: source scripts/local-stack/env.sh  -> exporta las variables para el stack local de PRUEBAS.
_keys="$(node "$(dirname "${BASH_SOURCE[0]}")/keys.mjs")"
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(echo "$_keys" | sed -n 's/^NEXT_PUBLIC_SUPABASE_ANON_KEY=//p')"
export SUPABASE_SERVICE_ROLE_KEY="$(echo "$_keys" | sed -n 's/^SUPABASE_SERVICE_ROLE_KEY=//p')"
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
export SMTP_HOST=127.0.0.1 SMTP_PORT=2500 EMAIL_FROM="Winter Arc <avisos@winterarc.local>"
export CRON_SECRET=local-test-cron-secret-0123456789
unset _keys
