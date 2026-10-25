begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.access_codes (
  code_hash bytea primary key check (octet_length(code_hash) = 32),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  redeemed_by uuid,
  redeemed_at timestamptz,
  check ((redeemed_by is null) = (redeemed_at is null))
);

alter table public.access_codes enable row level security;
revoke all on table public.access_codes from public, anon, authenticated, service_role;

create or replace function public.claim_signup_access_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted_access_code text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'access_code', '')));
  claimed_code_hash bytea;
begin
  if submitted_access_code !~ '^[A-HJ-NP-Z2-9]{16,32}$' then
    raise exception 'A valid 16–32 character access code is required';
  end if;

  update public.access_codes
    set redeemed_by = new.id,
        redeemed_at = now()
    where code_hash = extensions.digest(convert_to(submitted_access_code, 'UTF8'), 'sha256')
      and redeemed_at is null
    returning code_hash into claimed_code_hash;

  if claimed_code_hash is null then
    raise exception 'Access code is invalid or has already been used';
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'access_code';
  return new;
end;
$$;

revoke execute on function public.claim_signup_access_code() from public, anon, authenticated;

drop trigger if exists require_access_code_for_new_user on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, gender, age_range, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'gender', ''),
    nullif(new.raw_user_meta_data ->> 'age_range', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        gender = excluded.gender,
        age_range = excluded.age_range,
        avatar_url = excluded.avatar_url;

  insert into public.challenge_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.coin_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.generate_access_codes(p_codes text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_codes text[];
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_codes is null or cardinality(p_codes) not between 1 and 100 then
    raise exception 'Generate between 1 and 100 access codes at a time';
  end if;

  select array_agg(upper(btrim(code)))
    into normalized_codes
    from unnest(p_codes) as submitted(code);

  if exists (
    select 1
      from unnest(normalized_codes) as submitted(code)
      where code !~ '^[A-HJ-NP-Z2-9]{16,32}$'
  ) then
    raise exception 'Codes must contain 16–32 characters using the unambiguous access-code alphabet';
  end if;
  if cardinality(normalized_codes) <> (
    select count(distinct code)::integer
      from unnest(normalized_codes) as submitted(code)
  ) then
    raise exception 'Generated access codes must be unique';
  end if;

  insert into public.access_codes (code_hash, created_by)
    select extensions.digest(convert_to(code, 'UTF8'), 'sha256'), current_user_id
      from unnest(normalized_codes) as submitted(code);

  return cardinality(normalized_codes);
end;
$$;

revoke execute on function public.generate_access_codes(text[]) from public, anon;
grant execute on function public.generate_access_codes(text[]) to authenticated;

notify pgrst, 'reload schema';

commit;
