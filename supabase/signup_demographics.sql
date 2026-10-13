begin;

alter table public.profiles
  add column if not exists gender text,
  add column if not exists age_range text,
  drop constraint if exists profiles_gender_check,
  drop constraint if exists profiles_age_range_check,
  add constraint profiles_gender_check check (gender is null or gender in ('woman', 'man')),
  add constraint profiles_age_range_check check (age_range is null or age_range in ('<18', '18-25', '>25'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, gender, age_range)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'gender', ''),
    nullif(new.raw_user_meta_data ->> 'age_range', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        gender = excluded.gender,
        age_range = excluded.age_range;

  insert into public.challenge_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.coin_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

commit;
