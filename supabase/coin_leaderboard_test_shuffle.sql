begin;

create or replace function public.shuffle_coin_leaderboard_test_scores()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  test_user_count integer;
  previous_daily_order uuid[];
  previous_weekly_order uuid[];
  shuffled_daily_order uuid[];
  shuffled_weekly_order uuid[];
  attempt integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  select count(*)::integer
    into test_user_count
    from public.coin_leaderboard_test_profiles;
  if test_user_count < 2 then
    raise exception 'At least two leaderboard test users are required';
  end if;

  select array_agg(ranked.user_id order by ranked.daily_coin desc, ranked.user_id)
    into previous_daily_order
    from (
      select profile.user_id, coalesce(score.daily_coin, 0) as daily_coin
        from public.coin_leaderboard_test_profiles as profile
        left join public.coin_leaderboard_test_score_overrides as score using (user_id)
        order by coalesce(score.daily_coin, 0) desc, profile.user_id
        limit 10
    ) as ranked;
  select array_agg(ranked.user_id order by ranked.weekly_coin desc, ranked.user_id)
    into previous_weekly_order
    from (
      select profile.user_id, coalesce(score.weekly_coin, 0) as weekly_coin
        from public.coin_leaderboard_test_profiles as profile
        left join public.coin_leaderboard_test_score_overrides as score using (user_id)
        order by coalesce(score.weekly_coin, 0) desc, profile.user_id
        limit 10
    ) as ranked;

  for attempt in 1..25 loop
    insert into public.coin_leaderboard_test_score_overrides (user_id, daily_coin, weekly_coin, updated_at)
    select
      profile.user_id,
      (140 + 10 * floor(random() * 15))::integer,
      (980 + 10 * floor(random() * 99))::integer,
      now()
      from public.coin_leaderboard_test_profiles as profile
    on conflict (user_id) do update
      set daily_coin = excluded.daily_coin,
          weekly_coin = excluded.weekly_coin,
          updated_at = excluded.updated_at;

    select array_agg(ranked.user_id order by ranked.daily_coin desc, ranked.user_id)
      into shuffled_daily_order
      from (
        select profile.user_id, score.daily_coin
          from public.coin_leaderboard_test_profiles as profile
          join public.coin_leaderboard_test_score_overrides as score using (user_id)
          order by score.daily_coin desc, profile.user_id
          limit 10
      ) as ranked;
    select array_agg(ranked.user_id order by ranked.weekly_coin desc, ranked.user_id)
      into shuffled_weekly_order
      from (
        select profile.user_id, score.weekly_coin
          from public.coin_leaderboard_test_profiles as profile
          join public.coin_leaderboard_test_score_overrides as score using (user_id)
          order by score.weekly_coin desc, profile.user_id
          limit 10
      ) as ranked;

    if shuffled_daily_order is distinct from previous_daily_order
      and shuffled_weekly_order is distinct from previous_weekly_order then
      return test_user_count;
    end if;
  end loop;

  raise exception 'Could not generate a new Daily and Weekly test-user top 10 order';
end;
$$;

revoke execute on function public.shuffle_coin_leaderboard_test_scores() from public, anon;
grant execute on function public.shuffle_coin_leaderboard_test_scores() to authenticated;

notify pgrst, 'reload schema';

commit;
