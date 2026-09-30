-- =============================================================================
-- Insignia/marco Pro: los miembros de un grupo pueden ver quién es Pro en él.
-- Sólo expone un sí/no (sin fechas ni pagos) y sólo a miembros del grupo.
-- =============================================================================
create or replace function public.group_pro_members(p_group_id uuid)
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id
  from public.group_members m
  where m.group_id = p_group_id
    and exists (select 1 from public.group_members me where me.group_id = p_group_id and me.user_id = (select auth.uid()))
    and (private.is_pro(m.user_id) or private.is_staff(m.user_id));
$$;
revoke all on function public.group_pro_members(uuid) from public, anon;
grant execute on function public.group_pro_members(uuid) to authenticated;
