create or replace function public.reset_user_challenge_data(p_timezone text default 'UTC')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  reset_date date;
  settings_row public.challenge_settings%rowtype;
  wallet_balance integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to reset challenge data';
  end if;

  if p_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'A valid time zone is required to reset challenge data';
  end if;

  reset_date := (now() at time zone p_timezone)::date;

  insert into public.challenge_settings (user_id)
    values (current_user_id)
    on conflict (user_id) do nothing;

  select settings.*
    into settings_row
    from public.challenge_settings as settings
    where settings.user_id = current_user_id
    for update;

  delete from public.user_phase_quest_progress
    where user_id = current_user_id;
  delete from public.user_daily_quests
    where user_id = current_user_id;

  insert into public.coin_wallets (user_id, balance)
    values (current_user_id, 0)
    on conflict (user_id) do nothing;

  update public.coin_wallets
    set balance = 0,
        updated_at = now()
    where user_id = current_user_id
    returning balance into wallet_balance;

  update public.challenge_settings
    set start_date = reset_date,
        lives = 7,
        last_evaluated_day = 0,
        updated_at = now()
    where user_id = current_user_id
    returning * into settings_row;

  return jsonb_build_object(
    'start_date', settings_row.start_date,
    'lives', settings_row.lives,
    'coin_balance', wallet_balance
  );
end;
$$;

revoke execute on function public.reset_user_challenge_data(text) from public, anon;
grant execute on function public.reset_user_challenge_data(text) to authenticated;
