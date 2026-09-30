-- =============================================================================
-- Opiniones reales de usuarios y estadísticas públicas (sólo agregados).
-- Una opinión se publica sólo si su autor lo permite Y el staff la aprueba.
-- =============================================================================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 280),
  allow_public boolean not null default false,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
create policy "reviews: select own" on public.reviews for select to authenticated using (user_id = (select auth.uid()));
create policy "reviews: insert own" on public.reviews for insert to authenticated with check (user_id = (select auth.uid()) and approved = false);
create policy "reviews: update own" on public.reviews for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;
-- El autor nunca puede tocar "approved".
grant insert (user_id, rating, body, allow_public) on public.reviews to authenticated;
grant update (rating, body, allow_public, updated_at) on public.reviews to authenticated;

-- Si el autor edita su opinión, vuelve a revisión.
create or replace function private.reviews_reset_approval() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.body is distinct from old.body or new.rating is distinct from old.rating or (new.allow_public and not old.allow_public) then
    new.approved := false;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger reviews_reset_approval before update on public.reviews
  for each row execute function private.reviews_reset_approval();

-- Opiniones visibles en la web (cualquiera, sin sesión).
create or replace function public.public_reviews()
returns table (name text, avatar_emoji text, avatar_color text, rating smallint, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select split_part(btrim(p.display_name), ' ', 1), p.avatar_emoji, p.avatar_color, r.rating, r.body, r.created_at
  from public.reviews r join public.profiles p on p.id = r.user_id
  where r.approved and r.allow_public and r.rating >= 4 and char_length(btrim(r.body)) > 0
  order by r.updated_at desc
  limit 12;
$$;

-- Estadísticas agregadas (nada identificable).
create or replace function public.public_stats()
returns table (users int, habits_done int, habits_done_7d int, workouts int, workout_minutes int, avg_rating numeric, ratings int)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.profiles)::int,
    (select count(*) from public.habit_logs where status = 'done')::int,
    (select count(*) from public.habit_logs where status = 'done' and log_date > current_date - 7)::int,
    (select count(*) from public.workouts)::int,
    (select coalesce(sum(duration_min), 0) from public.workouts)::int,
    (select round(avg(rating)::numeric, 1) from public.reviews),
    (select count(*) from public.reviews)::int;
$$;

-- Moderación (sólo staff).
create or replace function public.staff_reviews()
returns table (id uuid, username text, display_name text, rating smallint, body text, allow_public boolean, approved boolean, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select r.id, p.username, p.display_name, r.rating, r.body, r.allow_public, r.approved, r.updated_at
  from public.reviews r join public.profiles p on p.id = r.user_id
  order by r.approved, r.updated_at desc
  limit 200;
end $$;

create or replace function public.staff_set_review_approved(p_review_id uuid, p_approved boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.reviews set approved = p_approved and allow_public where id = p_review_id;
end $$;

revoke all on function public.public_reviews(), public.public_stats(), public.staff_reviews(), public.staff_set_review_approved(uuid, boolean) from public;
grant execute on function public.public_reviews(), public.public_stats() to anon, authenticated;
grant execute on function public.staff_reviews(), public.staff_set_review_approved(uuid, boolean) to authenticated;
