begin;

create index if not exists user_phase_quest_leaderboard_completed_idx
  on public.user_phase_quest_progress (completed_at)
  where completed_at is not null and earned_coin > 0;

create index if not exists user_daily_quests_leaderboard_completed_idx
  on public.user_daily_quests (completed_at)
  where is_completed and earned_coin > 0;

create table if not exists public.coin_leaderboard_test_profiles (
  user_id uuid primary key,
  display_name text not null,
  avatar_url text not null,
  gender text not null check (gender in ('woman', 'man'))
);

create table if not exists public.coin_leaderboard_test_events (
  user_id uuid not null references public.coin_leaderboard_test_profiles (user_id) on delete cascade,
  earned_on date not null,
  earned_at timestamptz not null,
  earned_coin integer not null check (earned_coin between 200 and 450),
  primary key (user_id, earned_on)
);

alter table public.coin_leaderboard_test_profiles enable row level security;
alter table public.coin_leaderboard_test_events enable row level security;
revoke all on table public.coin_leaderboard_test_profiles from public, anon, authenticated;
revoke all on table public.coin_leaderboard_test_events from public, anon, authenticated;

drop function if exists public.get_coin_leaderboard(text);

create function public.get_coin_leaderboard(p_period text)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  gender text,
  total_coin bigint,
  leaderboard_rank integer,
  is_test_data boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  period_start timestamptz;
  period_end timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication is required to view the leaderboard';
  end if;

  if p_period = 'daily' then
    period_start := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  elsif p_period = 'weekly' then
    period_start := period_end - interval '7 days';
  else
    raise exception 'Leaderboard period must be daily or weekly';
  end if;

  return query
    with completed_coin_events as (
      select progress.user_id, progress.earned_coin::bigint as earned_coin, false as is_test_data
        from public.user_phase_quest_progress as progress
        where progress.completed_at >= period_start
          and progress.completed_at < period_end
          and progress.earned_coin > 0
      union all
      select quest.user_id, quest.earned_coin::bigint as earned_coin, false as is_test_data
        from public.user_daily_quests as quest
        where quest.is_completed
          and quest.completed_at >= period_start
          and quest.completed_at < period_end
          and quest.earned_coin > 0
      union all
      select event.user_id, event.earned_coin::bigint as earned_coin, true as is_test_data
        from public.coin_leaderboard_test_events as event
        where event.earned_at >= period_start
          and event.earned_at < period_end
      union all
      select
        test_profile.user_id,
        (
          200 + mod(abs(hashtext(test_profile.user_id::text || ':' || dates.event_day::date::text)::bigint), 251)
        )::bigint as earned_coin,
        true as is_test_data
        from public.coin_leaderboard_test_profiles as test_profile
        cross join lateral generate_series(
          ((period_start at time zone 'Asia/Jakarta')::date)::timestamp,
          ((period_end at time zone 'Asia/Jakarta')::date)::timestamp,
          interval '1 day'
        ) as dates(event_day)
        where least(
          (dates.event_day::date + time '12:00') at time zone 'Asia/Jakarta',
          period_end - interval '1 microsecond'
        ) >= period_start
          and least(
            (dates.event_day::date + time '12:00') at time zone 'Asia/Jakarta',
            period_end - interval '1 microsecond'
          ) < period_end
          and not exists (
            select 1
              from public.coin_leaderboard_test_events as saved_event
              where saved_event.user_id = test_profile.user_id
                and saved_event.earned_on = dates.event_day::date
          )
    ),
    user_totals as (
      select event.user_id, sum(event.earned_coin)::bigint as total_coin, bool_or(event.is_test_data) as is_test_data
        from completed_coin_events as event
        group by event.user_id
        having sum(event.earned_coin) > 0
    ),
    ranked_users as (
      select
        totals.user_id,
        coalesce(nullif(btrim(profile.full_name), ''), test_profile.display_name, 'JOolo member') as display_name,
        coalesce(profile.avatar_url, test_profile.avatar_url) as avatar_url,
        coalesce(profile.gender, test_profile.gender) as gender,
        totals.total_coin,
        row_number() over (order by totals.total_coin desc, totals.user_id)::integer as leaderboard_rank,
        totals.is_test_data
        from user_totals as totals
        left join public.profiles as profile on profile.id = totals.user_id
        left join public.coin_leaderboard_test_profiles as test_profile on test_profile.user_id = totals.user_id
    )
    select
      ranked.user_id,
      ranked.display_name,
      ranked.avatar_url,
      ranked.gender,
      ranked.total_coin,
      ranked.leaderboard_rank,
      ranked.is_test_data
      from ranked_users as ranked
      where ranked.leaderboard_rank <= 100
        or ranked.user_id = current_user_id
      order by ranked.leaderboard_rank;
end;
$$;

revoke execute on function public.get_coin_leaderboard(text) from public, anon;
grant execute on function public.get_coin_leaderboard(text) to authenticated;

commit;
