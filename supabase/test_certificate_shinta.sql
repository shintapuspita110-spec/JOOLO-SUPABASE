begin;

do $$
declare
  test_user_id uuid;
  test_start_date date := (now() at time zone 'Asia/Jakarta')::date - 39;
  available_days integer;
begin
  select profile.id
    into strict test_user_id
    from public.profiles as profile
    where lower(profile.email) = lower('shinta123@gmail.com');

  select count(distinct quest.day_number)
    into available_days
    from public.phase_daily_quests as quest
    where quest.day_number between 1 and 40;

  if available_days <> 40 then
    raise exception 'Expected phase challenges for all 40 days, found % days', available_days;
  end if;

  insert into public.challenge_settings (user_id, start_date, lives, last_evaluated_day, updated_at)
    values (test_user_id, test_start_date, 7, 0, now())
    on conflict (user_id) do update
      set start_date = excluded.start_date,
          lives = 7,
          last_evaluated_day = 0,
          updated_at = now();

  insert into public.user_phase_quest_progress (
    user_id,
    quest_id,
    achieved_amount,
    earned_coin,
    progress_updated,
    completed_at
  )
  select
    test_user_id,
    selected_quest.id,
    0,
    selected_quest.total_coin,
    false,
    ((test_start_date + (selected_quest.day_number - 1))::timestamp + interval '1 minute')
      at time zone 'Asia/Jakarta'
  from (
    select distinct on (quest.day_number)
      quest.id,
      quest.day_number,
      quest.total_coin
    from public.phase_daily_quests as quest
    where quest.day_number between 1 and 40
    order by quest.day_number, quest.max_possible_coin, quest.total_coin, quest.id
  ) as selected_quest
  on conflict (user_id, quest_id) do update
    set achieved_amount = excluded.achieved_amount,
        earned_coin = excluded.earned_coin,
        progress_updated = excluded.progress_updated,
        completed_at = excluded.completed_at;
end;
$$;

commit;

select
  profile.email,
  settings.start_date,
  count(distinct quest.day_number) filter (where progress.completed_at is not null) as completed_days,
  count(progress.quest_id) filter (where progress.completed_at is not null) as completed_challenges,
  wallet.balance as coin_balance
from public.profiles as profile
join public.challenge_settings as settings on settings.user_id = profile.id
join public.coin_wallets as wallet on wallet.user_id = profile.id
left join public.user_phase_quest_progress as progress on progress.user_id = profile.id
left join public.phase_daily_quests as quest on quest.id = progress.quest_id
where lower(profile.email) = lower('shinta123@gmail.com')
group by profile.email, settings.start_date, wallet.balance;
