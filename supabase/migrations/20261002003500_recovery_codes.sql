-- =============================================================================
-- Recuperar la contraseña sin correos: clave de recuperación personal.
-- La clave sólo se muestra una vez y se guarda cifrada (bcrypt). Al usarla se
-- invalida. Límites: 5 intentos/hora por cuenta y 20/hora por IP.
-- =============================================================================
create table if not exists private.recovery_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now()
);
alter table private.recovery_codes enable row level security;

-- 16 caracteres de un alfabeto sin confusiones (32 símbolos => 80 bits).
create or replace function private.new_recovery_code(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(16);
  v_raw text := '';
begin
  for i in 0..15 loop
    v_raw := v_raw || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  insert into private.recovery_codes (user_id, code_hash)
  values (p_user, extensions.crypt(v_raw, extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now();
  return substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4) || '-' || substr(v_raw, 13, 4);
end $$;
revoke all on function private.new_recovery_code(uuid) from public;

-- El usuario con sesión genera (o regenera) su propia clave.
create or replace function public.create_recovery_code() returns text
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = 'WA403';
  end if;
  perform private.check_rate_limit('recovery_create:' || auth.uid()::text, 10, interval '1 hour');
  return private.new_recovery_code(auth.uid());
end $$;

create or replace function public.has_recovery_code() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.recovery_codes where user_id = auth.uid());
$$;

revoke all on function public.create_recovery_code(), public.has_recovery_code() from public, anon;
grant execute on function public.create_recovery_code(), public.has_recovery_code() to authenticated;

-- Sólo el servidor (service_role): comprueba usuario/email + clave. Si es
-- correcta, la invalida, emite una nueva y devuelve el id para cambiar la contraseña.
create or replace function public.recovery_redeem(p_login text, p_code text, p_ip text)
returns table (user_id uuid, new_code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_login text := lower(btrim(coalesce(p_login, '')));
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_uid uuid;
  v_hash text;
begin
  perform private.check_rate_limit('recovery_ip:' || left(coalesce(p_ip, 'unknown'), 64), 20, interval '1 hour');
  perform private.check_rate_limit('recovery_login:' || left(v_login, 254), 5, interval '1 hour');

  select u.id into v_uid from auth.users u where lower(u.email) = v_login;
  if v_uid is null then
    select p.id into v_uid from public.profiles p where p.username = ltrim(v_login, '@');
  end if;
  select r.code_hash into v_hash from private.recovery_codes r where r.user_id = v_uid;

  -- Mismo coste aunque la cuenta no exista (no revela qué cuentas hay).
  if v_hash is null or length(v_code) <> 16 or extensions.crypt(v_code, v_hash) <> v_hash then
    perform extensions.crypt(v_code, coalesce(v_hash, extensions.gen_salt('bf', 10)));
    return;
  end if;

  return query select v_uid, private.new_recovery_code(v_uid);
end $$;
revoke all on function public.recovery_redeem(text, text, text) from public, anon, authenticated;
grant execute on function public.recovery_redeem(text, text, text) to service_role;
