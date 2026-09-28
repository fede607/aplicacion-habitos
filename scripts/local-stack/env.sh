# Uso: source scripts/local-stack/env.sh  -> exporta las variables para el stack local.
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(node "$(dirname "${BASH_SOURCE[0]}")/keys.mjs" | sed -n 's/^NEXT_PUBLIC_SUPABASE_ANON_KEY=//p')"
