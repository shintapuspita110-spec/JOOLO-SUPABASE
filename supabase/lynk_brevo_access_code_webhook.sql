begin;

alter table public.access_codes
  alter column created_by drop not null;

drop function if exists public.generate_access_codes(text[]);

create table if not exists public.lynk_access_code_deliveries (
  message_id text primary key,
  ref_id text not null unique,
  recipient_email text not null,
  recipient_name text not null default '',
  access_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check ((access_code is null) = (sent_at is not null))
);

alter table public.lynk_access_code_deliveries enable row level security;
revoke all on table public.lynk_access_code_deliveries from public, anon, authenticated, service_role;

create or replace function public.prepare_lynk_access_code(
  p_message_id text,
  p_ref_id text,
  p_email text,
  p_customer_name text
)
returns table (
  recipient_email text,
  recipient_name text,
  access_code text,
  already_sent boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_delivery public.lynk_access_code_deliveries%rowtype;
  random_bytes bytea;
  code_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  generated_code text := '';
  byte_index integer;
begin
  if p_message_id is null or length(btrim(p_message_id)) not between 1 and 200
    or p_ref_id is null or length(btrim(p_ref_id)) not between 1 and 200
    or p_email is null or length(btrim(p_email)) not between 3 and 320
    or position('@' in p_email) < 2 then
    raise exception 'Invalid Lynk payment details.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(btrim(p_ref_id), 0));

  select delivery.*
    into existing_delivery
    from public.lynk_access_code_deliveries as delivery
    where delivery.ref_id = btrim(p_ref_id)
       or delivery.message_id = btrim(p_message_id)
    limit 1;

  if found then
    if existing_delivery.ref_id <> btrim(p_ref_id)
      or existing_delivery.recipient_email <> lower(btrim(p_email)) then
      raise exception 'Lynk payment identifier conflicts with an existing delivery.';
    end if;

    return query select
      existing_delivery.recipient_email,
      existing_delivery.recipient_name,
      existing_delivery.access_code,
      existing_delivery.sent_at is not null;
    return;
  end if;

  random_bytes := extensions.gen_random_bytes(16);
  for byte_index in 0..15 loop
    generated_code := generated_code || substr(
      code_alphabet,
      (get_byte(random_bytes, byte_index) % length(code_alphabet)) + 1,
      1
    );
  end loop;

  insert into public.access_codes (code_hash, created_by)
    values (extensions.digest(convert_to(generated_code, 'UTF8'), 'sha256'), null);

  insert into public.lynk_access_code_deliveries (
    message_id,
    ref_id,
    recipient_email,
    recipient_name,
    access_code
  )
  values (
    btrim(p_message_id),
    btrim(p_ref_id),
    lower(btrim(p_email)),
    left(btrim(coalesce(p_customer_name, '')), 120),
    generated_code
  )
  returning
    lynk_access_code_deliveries.recipient_email,
    lynk_access_code_deliveries.recipient_name,
    lynk_access_code_deliveries.access_code
  into recipient_email, recipient_name, access_code;

  already_sent := false;
  return next;
end;
$$;

create or replace function public.mark_lynk_access_code_sent(p_ref_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lynk_access_code_deliveries
    set sent_at = now(),
        access_code = null
    where ref_id = btrim(p_ref_id)
      and sent_at is null
      and access_code is not null;

  if found then
    return true;
  end if;

  return exists (
    select 1
    from public.lynk_access_code_deliveries
    where ref_id = btrim(p_ref_id)
      and sent_at is not null
  );
end;
$$;

revoke execute on function public.prepare_lynk_access_code(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.mark_lynk_access_code_sent(text) from public, anon, authenticated;
grant execute on function public.prepare_lynk_access_code(text, text, text, text) to service_role;
grant execute on function public.mark_lynk_access_code_sent(text) to service_role;

notify pgrst, 'reload schema';

commit;
