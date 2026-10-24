begin;

create or replace function public.update_phase_daily_quest(
  p_quest_id text,
  p_focus text,
  p_task_name text,
  p_short_description text,
  p_frequency text,
  p_level text,
  p_target text,
  p_total_coin integer,
  p_skill_category_id text,
  p_soft_skills text,
  p_max_possible_coin integer,
  p_cover_image text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_quest_id text;
  target_amount numeric;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_quest_id is null then
    raise exception 'A phase daily quest ID is required';
  end if;
  if char_length(btrim(coalesce(p_focus, ''))) not between 1 and 200
    or char_length(btrim(coalesce(p_task_name, ''))) not between 1 and 100
    or char_length(btrim(coalesce(p_short_description, ''))) not between 1 and 300
    or char_length(btrim(coalesce(p_target, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_skill_category_id, ''))) not between 1 and 60
    or char_length(btrim(coalesce(p_soft_skills, ''))) not between 1 and 300
    or char_length(btrim(coalesce(p_cover_image, ''))) not between 1 and 500 then
    raise exception 'Challenge text fields are missing or exceed their allowed length';
  end if;
  if p_frequency is null or p_frequency not in ('One-Time', 'Daily', 'Weekly') then
    raise exception 'Frequency must be One-Time, Daily, or Weekly';
  end if;
  if p_level is null or p_level not in ('Easy', 'Medium', 'Hard') then
    raise exception 'Level must be Easy, Medium, or Hard';
  end if;
  if p_total_coin is null or p_total_coin < 0
    or p_max_possible_coin is null or p_max_possible_coin < p_total_coin then
    raise exception 'Coin rewards must be non-negative and maximum coins must cover the reward';
  end if;

  if p_target ~* '^\s*skala' then
    target_amount := replace(
      substring(p_target from '([0-9]+([.,][0-9]+)?)[^0-9]*$'),
      ',',
      '.'
    )::numeric;
  else
    target_amount := replace(
      substring(p_target from '^\s*([0-9]+([.,][0-9]+)?)'),
      ',',
      '.'
    )::numeric;
  end if;
  if target_amount is null then
    raise exception 'Target must begin with a numeric amount or use a scale with a numeric maximum';
  end if;

  update public.phase_daily_quests
    set focus = btrim(p_focus),
        task_name = btrim(p_task_name),
        short_description = btrim(p_short_description),
        frequency = p_frequency,
        level = p_level,
        target = btrim(p_target),
        total_coin = p_total_coin,
        skill_category_id = btrim(p_skill_category_id),
        soft_skills = btrim(p_soft_skills),
        max_possible_coin = p_max_possible_coin,
        cover_image = btrim(p_cover_image)
    where id = p_quest_id
    returning id into updated_quest_id;

  if updated_quest_id is null then
    raise exception 'Phase daily quest does not exist';
  end if;
  return updated_quest_id;
end;
$$;

revoke execute on function public.update_phase_daily_quest(text, text, text, text, text, text, text, integer, text, text, integer, text) from public, anon;
grant execute on function public.update_phase_daily_quest(text, text, text, text, text, text, text, integer, text, text, integer, text) to authenticated;

notify pgrst, 'reload schema';

commit;
