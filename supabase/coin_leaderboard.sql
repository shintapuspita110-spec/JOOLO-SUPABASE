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
  earned_coin integer not null check (earned_coin between 200 and 450 and mod(earned_coin, 10) = 0),
  primary key (user_id, earned_on)
);

create table if not exists public.coin_leaderboard_test_score_overrides (
  user_id uuid primary key references public.coin_leaderboard_test_profiles (user_id) on delete cascade,
  daily_coin integer not null default 0 check (daily_coin between 0 and 10000000 and mod(daily_coin, 10) = 0),
  weekly_coin integer not null default 0 check (weekly_coin between 0 and 10000000 and mod(weekly_coin, 10) = 0),
  updated_at timestamptz not null default now()
);

update public.coin_leaderboard_test_events
  set earned_coin = earned_coin - mod(earned_coin, 10)
  where mod(earned_coin, 10) <> 0;

alter table public.coin_leaderboard_test_events
  drop constraint if exists coin_leaderboard_test_events_earned_coin_check,
  add constraint coin_leaderboard_test_events_earned_coin_check
    check (earned_coin between 200 and 450 and mod(earned_coin, 10) = 0);

update public.coin_leaderboard_test_score_overrides
  set daily_coin = daily_coin - mod(daily_coin, 10),
      weekly_coin = weekly_coin - mod(weekly_coin, 10)
  where mod(daily_coin, 10) <> 0 or mod(weekly_coin, 10) <> 0;

alter table public.coin_leaderboard_test_score_overrides
  drop constraint if exists coin_leaderboard_test_score_overrides_daily_coin_check,
  add constraint coin_leaderboard_test_score_overrides_daily_coin_check
    check (daily_coin between 0 and 10000000 and mod(daily_coin, 10) = 0),
  drop constraint if exists coin_leaderboard_test_score_overrides_weekly_coin_check,
  add constraint coin_leaderboard_test_score_overrides_weekly_coin_check
    check (weekly_coin between 0 and 10000000 and mod(weekly_coin, 10) = 0);

insert into public.coin_leaderboard_test_score_overrides (user_id, daily_coin, weekly_coin)
select
  test_profile.user_id,
  coalesce(sum(event.earned_coin) filter (
    where event.earned_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and event.earned_at < now()
  ), 0)::integer,
  coalesce(sum(event.earned_coin) filter (
    where event.earned_at >= now() - interval '7 days'
      and event.earned_at < now()
  ), 0)::integer
from public.coin_leaderboard_test_profiles as test_profile
left join public.coin_leaderboard_test_events as event on event.user_id = test_profile.user_id
group by test_profile.user_id
on conflict (user_id) do nothing;

alter table public.coin_leaderboard_test_profiles enable row level security;
alter table public.coin_leaderboard_test_events enable row level security;
alter table public.coin_leaderboard_test_score_overrides enable row level security;
revoke all on table public.coin_leaderboard_test_profiles from public, anon, authenticated;
revoke all on table public.coin_leaderboard_test_events from public, anon, authenticated;
revoke all on table public.coin_leaderboard_test_score_overrides from public, anon, authenticated;

create or replace function public.get_coin_leaderboard_test_users()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  gender text,
  daily_coin integer,
  weekly_coin integer
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

create or replace function public.save_coin_leaderboard_test_user(
  p_user_id uuid,
  p_display_name text,
  p_gender text,
  p_daily_coin integer,
  p_weekly_coin integer
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
  if p_daily_coin is null or p_daily_coin not between 0 and 10000000 or mod(p_daily_coin, 10) <> 0
    or p_weekly_coin is null or p_weekly_coin not between 0 and 10000000 or mod(p_weekly_coin, 10) <> 0 then
    raise exception 'Daily and weekly coins must be multiples of 10 between 0 and 10000000';
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

create or replace function public.delete_coin_leaderboard_test_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_user_id is null then
    raise exception 'A test user ID is required';
  end if;

  delete from public.coin_leaderboard_test_profiles
    where user_id = p_user_id;
  if not found then
    raise exception 'Test user was not found';
  end if;
end;
$$;

revoke execute on function public.get_coin_leaderboard_test_users() from public, anon;
revoke execute on function public.save_coin_leaderboard_test_user(uuid, text, text, integer, integer) from public, anon;
revoke execute on function public.delete_coin_leaderboard_test_user(uuid) from public, anon;
grant execute on function public.get_coin_leaderboard_test_users() to authenticated;
grant execute on function public.save_coin_leaderboard_test_user(uuid, text, text, integer, integer) to authenticated;
grant execute on function public.delete_coin_leaderboard_test_user(uuid) to authenticated;

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
          and (
            p_period = 'weekly'
            or exists (
              select 1
                from public.phase_daily_quests as phase_quest
                join public.challenge_settings as settings on settings.user_id = progress.user_id
                where phase_quest.id = progress.quest_id
                  and phase_quest.day_number =
                    ((now() at time zone 'Asia/Jakarta')::date - settings.start_date + 1)
            )
          )
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
          and not exists (
            select 1 from public.coin_leaderboard_test_score_overrides as score
            where score.user_id = event.user_id
          )
      union all
      select
        score.user_id,
        case when p_period = 'daily' then score.daily_coin else score.weekly_coin end::bigint as earned_coin,
        true as is_test_data
        from public.coin_leaderboard_test_score_overrides as score
        where case when p_period = 'daily' then score.daily_coin else score.weekly_coin end > 0
      union all
      select
        test_profile.user_id,
        (
          200 + 10 * mod(abs(hashtext(test_profile.user_id::text || ':' || dates.event_day::date::text)::bigint), 26)
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
          and not exists (
            select 1 from public.coin_leaderboard_test_score_overrides as score
            where score.user_id = test_profile.user_id
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

notify pgrst, 'reload schema';

commit;
