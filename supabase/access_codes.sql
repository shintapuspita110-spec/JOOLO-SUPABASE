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
drop function if exists public.generate_access_codes(text[]);

create unique index if not exists access_codes_redeemed_by_unique
  on public.access_codes (redeemed_by)
  where redeemed_by is not null;

drop trigger if exists require_access_code_for_new_user on auth.users;
drop function if exists public.claim_signup_access_code();

create or replace function public.has_claimed_access_code()
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.access_codes
    where redeemed_by = (select auth.uid())
  );
end;
$$;

revoke execute on function public.has_claimed_access_code() from public, anon;
grant execute on function public.has_claimed_access_code() to authenticated;

create or replace function public.claim_access_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  submitted_code text := upper(btrim(coalesce(p_code, '')));
  claimed_code_hash bytea;
begin
  if current_user_id is null then
    raise exception 'Silakan masuk untuk mengklaim kode akses.';
  end if;
  if submitted_code !~ '^[A-HJ-NP-Z2-9]{16,32}$' then
    raise exception 'Masukkan kode akses JOOLO yang valid.';
  end if;
  if exists (
    select 1
    from public.access_codes
    where redeemed_by = current_user_id
  ) then
    raise exception 'Akun ini sudah pernah mengklaim kode akses.';
  end if;

  update public.access_codes
  set redeemed_by = current_user_id,
      redeemed_at = now()
  where code_hash = extensions.digest(convert_to(submitted_code, 'UTF8'), 'sha256')
    and redeemed_at is null
  returning code_hash into claimed_code_hash;

  if claimed_code_hash is null then
    raise exception 'Kode akses tidak valid atau sudah pernah digunakan.';
  end if;

  return true;
exception
  when unique_violation then
    raise exception 'Akun ini sudah pernah mengklaim kode akses.';
end;
$$;

revoke execute on function public.claim_access_code(text) from public, anon;
grant execute on function public.claim_access_code(text) to authenticated;

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

notify pgrst, 'reload schema';

commit;
