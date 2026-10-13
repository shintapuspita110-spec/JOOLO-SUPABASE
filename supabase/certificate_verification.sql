begin;

create table if not exists public.certificate_monthly_sequences (
  issue_month date primary key,
  last_number bigint not null check (last_number > 0)
);

alter table public.certificate_monthly_sequences enable row level security;
revoke all on table public.certificate_monthly_sequences from public, anon, authenticated;

create table if not exists public.user_certificates (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  verification_code text not null unique,
  issued_at timestamptz not null,
  certificate_name text,
  assessment_snapshot jsonb
);

alter table public.user_certificates
  add column if not exists certificate_name text,
  add column if not exists assessment_snapshot jsonb;

update public.user_certificates
  set verification_code = left(verification_code, length(verification_code) - 4)
    || lpad(right(verification_code, 4), 5, '0')
  where verification_code ~ '/[0-9]{4}$';

alter table public.user_certificates enable row level security;
revoke all on table public.user_certificates from public, anon, authenticated;

drop function if exists public.issue_40_day_certificate();

create or replace function public.issue_40_day_certificate(
  p_certificate_name text,
  p_assessment_snapshot jsonb
)
returns table (
  verification_code text,
  issued_at timestamptz,
  certificate_name text,
  assessment_snapshot jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_certificate public.user_certificates%rowtype;
  issued_time timestamptz;
  sequence_month date;
  month_number integer;
  serial_number bigint;
  month_roman text;
  completed_days integer;
  verification_id text;
  assessment_skill_count integer;
  saved_certificate_name text;
  saved_assessment_snapshot jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to claim a certificate';
  end if;

  if p_certificate_name is null or length(btrim(p_certificate_name)) = 0 or length(btrim(p_certificate_name)) > 120 then
    raise exception 'A valid certificate name is required';
  end if;

  perform 1
    from public.profiles as profile
    where profile.id = current_user_id
    for update;

  if not found then
    raise exception 'A profile is required to claim a certificate';
  end if;

  select certificate.*
    into existing_certificate
    from public.user_certificates as certificate
    where certificate.user_id = current_user_id;

  if found then
    return query
      select existing_certificate.verification_code,
        existing_certificate.issued_at,
        existing_certificate.certificate_name,
        existing_certificate.assessment_snapshot;
    return;
  end if;

  select count(distinct quest.day_number)::integer
    into completed_days
    from public.user_phase_quest_progress as progress
    join public.phase_daily_quests as quest on quest.id = progress.quest_id
    where progress.user_id = current_user_id
      and progress.completed_at is not null
      and quest.day_number between 1 and 40;

  if completed_days < 40 then
    raise exception 'Complete at least one challenge on each of the 40 days before claiming a certificate';
  end if;

  if jsonb_typeof(p_assessment_snapshot) is distinct from 'array' then
    raise exception 'A complete certificate assessment snapshot is required';
  end if;

  if jsonb_array_length(p_assessment_snapshot) <> 6 then
    raise exception 'A complete certificate assessment snapshot is required';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_assessment_snapshot) as item
      where coalesce(jsonb_typeof(item), 'null') <> 'object'
        or coalesce(jsonb_typeof(item -> 'skillCategoryId'), 'null') <> 'string'
        or coalesce(jsonb_typeof(item -> 'softSkills'), 'null') <> 'string'
        or coalesce(jsonb_typeof(item -> 'earnedCoin'), 'null') <> 'number'
        or coalesce(jsonb_typeof(item -> 'maxPossibleCoin'), 'null') <> 'number'
        or item ->> 'skillCategoryId' not in ('SKILL_01', 'SKILL_02', 'SKILL_03', 'SKILL_04', 'SKILL_05', 'SKILL_06')
        or length(btrim(item ->> 'softSkills')) = 0
  ) then
    raise exception 'The certificate assessment snapshot contains invalid fields';
  end if;

  select count(distinct item ->> 'skillCategoryId')::integer
    into assessment_skill_count
    from jsonb_array_elements(p_assessment_snapshot) as item;

  if assessment_skill_count <> 6 then
    raise exception 'The certificate assessment snapshot must contain each skill exactly once';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_assessment_snapshot) as item
      join (values
        ('SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability'),
        ('SKILL_02', 'System Thinking, Discipline, & Operational Efficiency'),
        ('SKILL_03', 'Focus Mastery, Task Initiation, & Time Management'),
        ('SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries'),
        ('SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making'),
        ('SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance')
      ) as expected(skill_id, skill_name)
        on item ->> 'skillCategoryId' = expected.skill_id
      where item ->> 'softSkills' is distinct from expected.skill_name
  ) then
    raise exception 'The certificate assessment snapshot contains unexpected skill names';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_assessment_snapshot) as item
      where (item ->> 'earnedCoin')::numeric < 0
        or (item ->> 'maxPossibleCoin')::numeric < 0
  ) then
    raise exception 'The certificate assessment snapshot contains invalid scores';
  end if;

  issued_time := clock_timestamp();
  sequence_month := date_trunc('month', issued_time at time zone 'Asia/Jakarta')::date;
  month_number := extract(month from issued_time at time zone 'Asia/Jakarta')::integer;
  month_roman := (array['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'])[month_number];

  insert into public.certificate_monthly_sequences as monthly_sequence (issue_month, last_number)
    values (sequence_month, 1)
    on conflict on constraint certificate_monthly_sequences_pkey do update
      set last_number = monthly_sequence.last_number + 1
    returning last_number into serial_number;

  verification_id := 'JOOLO/40DC/'
    || month_roman
    || '/'
    || to_char(issued_time at time zone 'Asia/Jakarta', 'YYYY')
    || '/'
    || lpad(serial_number::text, 5, '0');

  insert into public.user_certificates as certificate (
    user_id,
    verification_code,
    issued_at,
    certificate_name,
    assessment_snapshot
  )
    values (current_user_id, verification_id, issued_time, btrim(p_certificate_name), p_assessment_snapshot)
    on conflict (user_id) do nothing
    returning certificate.verification_code,
      certificate.issued_at,
      certificate.certificate_name,
      certificate.assessment_snapshot
      into verification_id, issued_time, saved_certificate_name, saved_assessment_snapshot;

  if not found then
    select certificate.verification_code,
      certificate.issued_at,
      certificate.certificate_name,
      certificate.assessment_snapshot
      into verification_id, issued_time, saved_certificate_name, saved_assessment_snapshot
      from public.user_certificates as certificate
      where certificate.user_id = current_user_id;
  else
    saved_certificate_name := btrim(p_certificate_name);
    saved_assessment_snapshot := p_assessment_snapshot;
  end if;

  return query select verification_id, issued_time, saved_certificate_name, saved_assessment_snapshot;
end;
$$;

revoke execute on function public.issue_40_day_certificate(text, jsonb) from public, anon;
grant execute on function public.issue_40_day_certificate(text, jsonb) to authenticated;

create or replace function public.get_40_day_certificate()
returns table (
  verification_code text,
  issued_at timestamptz,
  certificate_name text,
  assessment_snapshot jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required to view a certificate';
  end if;

  return query
    select certificate.verification_code,
      certificate.issued_at,
      certificate.certificate_name,
      certificate.assessment_snapshot
      from public.user_certificates as certificate
      where certificate.user_id = current_user_id;
end;
$$;

revoke execute on function public.get_40_day_certificate() from public, anon;
grant execute on function public.get_40_day_certificate() to authenticated;

drop function if exists public.verify_40_day_certificate(text);

commit;
