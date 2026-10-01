-- Pro gratis: SÓLO el mes de prueba. Se quita el premio de +7 días por invitar
-- y se recortan los días extra ya dados (p. ej. Marco: 6 nov -> fin de su mes).
create or replace function private.reward_referral(p_inviter uuid, p_new_user uuid)
returns void language sql security definer set search_path = '' as $$ select null::void $$;

update private.pro_bonus b
set until = least(b.until, coalesce(private.pro_trial_end(b.user_id), now()))
where b.until > now()
  and not exists (select 1 from public.profiles p where p.id = b.user_id and p.can_create_groups);
