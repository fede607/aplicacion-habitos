-- Plan personalizado: más opciones (definir, zona prioritaria, días concretos y más lesiones).
alter table public.training_profiles drop constraint if exists training_profiles_goal_check;
alter table public.training_profiles add constraint training_profiles_goal_check check (goal in ('fat_loss', 'recomp', 'muscle', 'strength', 'endurance', 'health'));
alter table public.training_profiles drop constraint if exists training_profiles_limitations_check;
alter table public.training_profiles add constraint training_profiles_limitations_check check (limitations <@ array['knee', 'lower_back', 'shoulder', 'wrist', 'hip', 'ankle']::text[]);
alter table public.training_profiles add column if not exists focus text not null default 'balanced'
  check (focus in ('balanced', 'glutes_legs', 'chest_arms', 'back_posture', 'shoulders', 'core'));
alter table public.training_profiles add column if not exists preferred_days smallint[] not null default '{}'
  check (preferred_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(preferred_days) <= 7);
