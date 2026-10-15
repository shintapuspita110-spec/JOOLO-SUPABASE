begin;

alter table public.coin_leaderboard_test_score_overrides
  drop constraint if exists coin_leaderboard_test_score_overrides_daily_coin_check,
  drop constraint if exists coin_leaderboard_test_score_overrides_weekly_coin_check;

alter table public.coin_leaderboard_test_score_overrides
  alter column daily_coin type bigint using daily_coin::bigint,
  alter column weekly_coin type bigint using weekly_coin::bigint,
  add constraint coin_leaderboard_test_score_overrides_daily_coin_check
    check (daily_coin >= 140 and mod(daily_coin, 10) = 0),
  add constraint coin_leaderboard_test_score_overrides_weekly_coin_check
    check (weekly_coin >= 980 and mod(weekly_coin, 10) = 0);

drop function if exists public.get_coin_leaderboard_test_users();

create function public.get_coin_leaderboard_test_users()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  gender text,
  daily_coin bigint,
  weekly_coin bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  return query
    select
      profile.user_id,
      profile.display_name,
      profile.avatar_url,
      profile.gender,
      coalesce(score.daily_coin, 0),
      coalesce(score.weekly_coin, 0)
    from public.coin_leaderboard_test_profiles as profile
    left join public.coin_leaderboard_test_score_overrides as score using (user_id)
    order by profile.display_name, profile.user_id;
end;
$$;

drop function if exists public.save_coin_leaderboard_test_user(uuid, text, text, integer, integer);

create function public.save_coin_leaderboard_test_user(
  p_user_id uuid,
  p_display_name text,
  p_gender text,
  p_daily_coin bigint,
  p_weekly_coin bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := btrim(p_display_name);
  selected_avatar text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_user_id is null then
    raise exception 'A test user ID is required';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 60 then
    raise exception 'Display name must contain between 1 and 60 characters';
  end if;
  if p_gender is null or p_gender not in ('woman', 'man') then
    raise exception 'Gender must be woman or man';
  end if;
  if p_daily_coin is null or p_daily_coin < 140 or mod(p_daily_coin, 10) <> 0
    or p_weekly_coin is null or p_weekly_coin < 980 or mod(p_weekly_coin, 10) <> 0 then
    raise exception 'Daily coins must be at least 140 and weekly coins at least 980, in multiples of 10';
  end if;

  selected_avatar := case
    when p_gender = 'man' then
      (array['/AVATAR/Man/Ray.png', '/AVATAR/Man/Atlas.png', '/AVATAR/Man/Finn.png', '/AVATAR/Man/Cosmo.png'])
        [1 + mod(get_byte(decode(substr(md5(p_user_id::text), 1, 2), 'hex'), 0), 4)]
    else
      (array['/AVATAR/Woman/Luna.png', '/AVATAR/Woman/Rosie.png', '/AVATAR/Woman/Stella.png', '/AVATAR/Woman/Aurora.png'])
        [1 + mod(get_byte(decode(substr(md5(p_user_id::text), 1, 2), 'hex'), 0), 4)]
  end;

  insert into public.coin_leaderboard_test_profiles (user_id, display_name, avatar_url, gender)
  values (p_user_id, normalized_name, selected_avatar, p_gender)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        gender = excluded.gender;

  insert into public.coin_leaderboard_test_score_overrides (user_id, daily_coin, weekly_coin, updated_at)
  values (p_user_id, p_daily_coin, p_weekly_coin, now())
  on conflict (user_id) do update
    set daily_coin = excluded.daily_coin,
        weekly_coin = excluded.weekly_coin,
        updated_at = excluded.updated_at;

  return p_user_id;
end;
$$;

revoke execute on function public.get_coin_leaderboard_test_users() from public, anon;
revoke execute on function public.save_coin_leaderboard_test_user(uuid, text, text, bigint, bigint) from public, anon;
grant execute on function public.get_coin_leaderboard_test_users() to authenticated;
grant execute on function public.save_coin_leaderboard_test_user(uuid, text, text, bigint, bigint) to authenticated;

notify pgrst, 'reload schema';

commit;
