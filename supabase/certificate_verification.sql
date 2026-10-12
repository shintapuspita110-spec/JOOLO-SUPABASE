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
  issued_at timestamptz not null
);

update public.user_certificates
  set verification_code = left(verification_code, length(verification_code) - 4)
    || lpad(right(verification_code, 4), 5, '0')
  where verification_code ~ '/[0-9]{4}$';

alter table public.user_certificates enable row level security;
revoke all on table public.user_certificates from public, anon, authenticated;

create or replace function public.issue_40_day_certificate()
returns table (
  verification_code text,
  issued_at timestamptz
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
begin
  if current_user_id is null then
    raise exception 'Authentication is required to claim a certificate';
  end if;

  perform 1
    from public.profiles as profile
    where profile.id = current_user_id
    for update;

  if not found then
    raise exception 'A profile is required to claim a certificate';
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

  select certificate.*
    into existing_certificate
    from public.user_certificates as certificate
    where certificate.user_id = current_user_id;

  if found then
    return query
      select existing_certificate.verification_code, existing_certificate.issued_at;
    return;
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

  insert into public.user_certificates as certificate (user_id, verification_code, issued_at)
    values (current_user_id, verification_id, issued_time)
    on conflict (user_id) do nothing
    returning certificate.verification_code, certificate.issued_at
      into verification_id, issued_time;

  if not found then
    select certificate.verification_code, certificate.issued_at
      into verification_id, issued_time
      from public.user_certificates as certificate
      where certificate.user_id = current_user_id;
  end if;

  return query select verification_id, issued_time;
end;
$$;

revoke execute on function public.issue_40_day_certificate() from public, anon;
grant execute on function public.issue_40_day_certificate() to authenticated;

drop function if exists public.verify_40_day_certificate(text);

commit;
