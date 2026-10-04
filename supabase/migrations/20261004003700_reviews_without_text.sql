-- Las valoraciones sólo con estrellas (sin texto) también se pueden publicar:
-- se muestran como «Nombre ★★★★★» y cuentan en la nota media.
create or replace function public.public_reviews()
 returns table(name text, avatar_emoji text, avatar_color text, rating smallint, body text, created_at timestamp with time zone)
 language sql stable security definer set search_path to '' as $function$
  select split_part(btrim(p.display_name), ' ', 1), p.avatar_emoji, p.avatar_color, r.rating, btrim(coalesce(r.body, '')), r.created_at
  from public.reviews r join public.profiles p on p.id = r.user_id
  where r.approved and r.allow_public and r.rating >= 4
  order by (char_length(btrim(coalesce(r.body, ''))) > 0) desc, r.updated_at desc
  limit 50;
$function$;
