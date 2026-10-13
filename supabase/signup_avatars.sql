begin;

alter table public.profiles
  add column if not exists avatar_url text,
  drop constraint if exists profiles_avatar_url_check,
  add constraint profiles_avatar_url_check check (
    avatar_url is null
    or (gender = 'woman' and avatar_url in (
      '/AVATAR/Woman/Luna.png',
      '/AVATAR/Woman/Rosie.png',
      '/AVATAR/Woman/Stella.png',
      '/AVATAR/Woman/Aurora.png'
    ))
    or (gender = 'man' and avatar_url in (
      '/AVATAR/Man/Ray.png',
      '/AVATAR/Man/Atlas.png',
      '/AVATAR/Man/Finn.png',
      '/AVATAR/Man/Cosmo.png'
    ))
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, gender, age_range, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'gender', ''),
    nullif(new.raw_user_meta_data ->> 'age_range', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        gender = excluded.gender,
        age_range = excluded.age_range,
        avatar_url = excluded.avatar_url;

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
