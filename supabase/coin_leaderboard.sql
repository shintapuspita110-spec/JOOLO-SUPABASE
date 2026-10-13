begin;

create index if not exists user_phase_quest_leaderboard_completed_idx
  on public.user_phase_quest_progress (completed_at)
  where completed_at is not null and earned_coin > 0;

create index if not exists user_daily_quests_leaderboard_completed_idx
  on public.user_daily_quests (completed_at)
  where is_completed and earned_coin > 0;

create or replace function public.get_coin_leaderboard(p_period text)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  gender text,
  total_coin bigint,
  leaderboard_rank integer
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
      select progress.user_id, progress.earned_coin::bigint as earned_coin
        from public.user_phase_quest_progress as progress
        where progress.completed_at >= period_start
          and progress.completed_at < period_end
          and progress.earned_coin > 0
      union all
      select quest.user_id, quest.earned_coin::bigint as earned_coin
        from public.user_daily_quests as quest
        where quest.is_completed
          and quest.completed_at >= period_start
          and quest.completed_at < period_end
          and quest.earned_coin > 0
    ),
    user_totals as (
      select event.user_id, sum(event.earned_coin)::bigint as total_coin
        from completed_coin_events as event
        group by event.user_id
        having sum(event.earned_coin) > 0
    ),
    ranked_users as (
      select
        totals.user_id,
        coalesce(nullif(btrim(profile.full_name), ''), 'JOolo member') as display_name,
        profile.avatar_url,
        profile.gender,
        totals.total_coin,
        row_number() over (order by totals.total_coin desc, totals.user_id)::integer as leaderboard_rank
        from user_totals as totals
        join public.profiles as profile on profile.id = totals.user_id
    )
    select
      ranked.user_id,
      ranked.display_name,
      ranked.avatar_url,
      ranked.gender,
      ranked.total_coin,
      ranked.leaderboard_rank
      from ranked_users as ranked
      where ranked.leaderboard_rank <= 10
        or ranked.user_id = current_user_id
      order by ranked.leaderboard_rank;
end;
$$;

revoke execute on function public.get_coin_leaderboard(text) from public, anon;
grant execute on function public.get_coin_leaderboard(text) to authenticated;

commit;
