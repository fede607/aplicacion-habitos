-- Página /opiniones: hasta 50 opiniones públicas aprobadas.
create or replace function public.public_reviews()
returns table (name text, avatar_emoji text, avatar_color text, rating smallint, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select split_part(btrim(p.display_name), ' ', 1), p.avatar_emoji, p.avatar_color, r.rating, r.body, r.created_at
  from public.reviews r join public.profiles p on p.id = r.user_id
  where r.approved and r.allow_public and r.rating >= 4 and char_length(btrim(r.body)) > 0
  order by r.updated_at desc
  limit 50;
$$;
