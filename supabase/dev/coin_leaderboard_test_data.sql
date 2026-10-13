-- Apply only to a local Supabase development database after coin_leaderboard.sql.
-- Inserts isolated synthetic profiles and seven days of test coin events.
begin;

with test_users(user_number, display_name, gender) as (
  values
    (1, 'kalingga', 'man'),
    (2, 'Gibran Raditya', 'man'),
    (3, 'kanaya kirana p.', 'woman'),
    (4, 'danendra', 'man'),
    (5, 'blueberry_tea', 'woman'),
    (6, 'Damar Banyu Brawijaya', 'man'),
    (7, 'calista zevanya', 'woman'),
    (8, 'nares', 'man'),
    (9, 'Syakira Alayya Humaira', 'woman'),
    (10, 'kenzo tristan', 'man'),
    (11, 'arsyana', 'woman'),
    (12, 'Reyhan Januarta F.', 'man'),
    (13, 'clarissa jovanka', 'woman'),
    (14, 'Tirta Mahardika', 'man'),
    (15, 'kalyana shafa arundati', 'woman'),
    (16, 'bramantyo', 'man'),
    (17, 'alea khairunnisa', 'woman'),
    (18, 'Faris Arsalan Syahputra', 'man'),
    (19, 'shanea_g', 'woman'),
    (20, 'fahreza rasyid', 'man'),
    (21, 'Keynalda Zevana Maharani', 'woman'),
    (22, 'devano', 'man'),
    (23, 'nabila hapsari', 'woman'),
    (24, 'Daniswara Raka Prawira', 'man'),
    (25, 'safira arundati', 'woman'),
    (26, 'amabel', 'woman'),
    (27, 'Rakha Ghifari', 'man'),
    (28, 'tirta larasati', 'woman'),
    (29, 'Rizky Bayuaji Pratama', 'man'),
    (30, 'nadhira azzahra', 'woman'),
    (31, 'rangga dewanjaya', 'man'),
    (32, 'zalfa salsabila n.', 'woman'),
    (33, 'Bimo Sakti', 'man'),
    (34, 'farah arisanti', 'woman'),
    (35, 'Aryaguna Wibowo Putra', 'man'),
    (36, 'keisha_aurellia', 'woman'),
    (37, 'marten galih', 'man'),
    (38, 'Alya Nurmasari Dewi', 'woman'),
    (39, 'wildan', 'man'),
    (40, 'tanisha sabreen', 'woman'),
    (41, 'Rafi Kurniawan Syah', 'man'),
    (42, 'aurelia zahrani', 'woman'),
    (43, 'arka raynar', 'man'),
    (44, 'Sekar Mayang Wandira', 'woman'),
    (45, 'mas_daven', 'man'),
    (46, 'diva kirana', 'woman'),
    (47, 'Zavier Abisali Nugraha', 'man'),
    (48, 'maheswari laksmi', 'woman'),
    (49, 'gavin rafandra', 'man'),
    (50, 'Aina Talita Syafiqah', 'woman'),
    (51, 'bastian', 'man'),
    (52, 'valerie felicia', 'woman'),
    (53, 'Arsyad Syahputra Perkasa', 'man'),
    (54, 'keysha_ramadhani', 'woman'),
    (55, 'narendra', 'man'),
    (56, 'Nayla Amanda Putri', 'woman'),
    (57, 'zidan syailendra', 'man'),
    (58, 'caitlin', 'woman'),
    (59, 'Dionysius Putra Utama', 'man'),
    (60, 'kania larasati', 'woman'),
    (61, 'fabian alza', 'man'),
    (62, 'Michelle Clarissa P.', 'woman'),
    (63, 'pradipta', 'man'),
    (64, 'savitri wardani', 'woman'),
    (65, 'Elzo Ferdian Kusuma', 'man'),
    (66, 'carissa qirani', 'woman'),
    (67, 'tegar mahardika', 'man'),
    (68, 'Alisha Najwa Salsabila', 'woman'),
    (69, 'gilang ramadhan', 'man'),
    (70, 'mimi_cat', 'woman'),
    (71, 'Rifqi Arkan Syahbana', 'man'),
    (72, 'audrey natasha', 'woman'),
    (73, 'galang', 'man'),
    (74, 'Tania Nurhaliza Putri', 'woman'),
    (75, 'kenzie_r', 'man'),
    (76, 'zevanya anjani', 'woman'),
    (77, 'Reihan Alfarizi Ahmad', 'man'),
    (78, 'azza nabilah', 'woman'),
    (79, 'fathan', 'man'),
    (80, 'Nadira Kirana Syafiqah', 'woman'),
    (81, 'rayhan febrian', 'man'),
    (82, 'nabila widya', 'woman'),
    (83, 'Adriel Setiawan Putra', 'man'),
    (84, 'misha', 'woman'),
    (85, 'Izanagi Arka', 'man'),
    (86, 'salma salsabila rahma', 'woman'),
    (87, 'haikal', 'man'),
    (88, 'ardhia regita', 'woman'),
    (89, 'Faizal Amir Syahputra', 'man'),
    (90, 'jesslyn jovanka', 'woman'),
    (91, 'arvin', 'man'),
    (92, 'Nia Kurniati Syafiqah', 'woman'),
    (93, 'bagas triyono', 'man'),
    (94, 'chelsea ardhia', 'woman'),
    (95, 'Rizwan Hidayatullah', 'man'),
    (96, 'amara shani', 'woman'),
    (97, 'satria perkasa', 'man'),
    (98, 'Qonita Zahrani Putri', 'woman'),
    (99, 'dafa pratama', 'man'),
    (100, 'Rania Callista Dewi', 'woman')
),
ranked_test_users as (
  select
    user_number,
    display_name,
    gender,
    row_number() over (
      partition by gender
      order by md5('joolo-test-avatar-' || user_number::text)
    ) as gender_avatar_number
  from test_users
)
insert into public.coin_leaderboard_test_profiles (user_id, display_name, avatar_url, gender)
select
  md5('joolo-leaderboard-test-user-' || lpad(users.user_number::text, 3, '0'))::uuid,
  users.display_name,
  case
    when users.gender = 'man' then
      (array[
        '/AVATAR/Man/Ray.png',
        '/AVATAR/Man/Atlas.png',
        '/AVATAR/Man/Finn.png',
        '/AVATAR/Man/Cosmo.png'
      ])[((users.gender_avatar_number - 1) % 4) + 1]
    else
      (array[
        '/AVATAR/Woman/Luna.png',
        '/AVATAR/Woman/Rosie.png',
        '/AVATAR/Woman/Stella.png',
        '/AVATAR/Woman/Aurora.png'
      ])[((users.gender_avatar_number - 1) % 4) + 1]
  end,
  users.gender
from ranked_test_users as users
on conflict (user_id) do update
  set display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      gender = excluded.gender;

insert into public.coin_leaderboard_test_events (user_id, earned_on, earned_at, earned_coin)
select
  md5('joolo-leaderboard-test-user-' || lpad(users.user_number::text, 3, '0'))::uuid,
  dates.earned_on,
  case
    when dates.day_offset = 0 then now()
    else (dates.earned_on + time '12:00') at time zone 'Asia/Jakarta'
  end,
  200 + mod(users.user_number * 17 + dates.day_offset * 29, 251)
from generate_series(1, 100) as users(user_number)
cross join generate_series(0, 6) as day_offsets(day_offset)
cross join lateral (
  select
    (now() at time zone 'Asia/Jakarta')::date - day_offsets.day_offset as earned_on,
    day_offsets.day_offset
) as dates
on conflict (user_id, earned_on) do nothing;

insert into public.coin_leaderboard_test_score_overrides (user_id, daily_coin, weekly_coin)
select
  profile.user_id,
  coalesce(sum(event.earned_coin) filter (
    where event.earned_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
      and event.earned_at < now()
  ), 0)::integer,
  coalesce(sum(event.earned_coin) filter (
    where event.earned_at >= now() - interval '7 days'
      and event.earned_at < now()
  ), 0)::integer
from public.coin_leaderboard_test_profiles as profile
left join public.coin_leaderboard_test_events as event on event.user_id = profile.user_id
group by profile.user_id
on conflict (user_id) do nothing;

commit;

select
  (select count(*) from public.coin_leaderboard_test_profiles) as test_user_count,
  (select count(*) from public.coin_leaderboard_test_score_overrides) as test_score_override_count,
  (select count(*) from public.coin_leaderboard_test_events) as saved_test_coin_event_count,
  (select min(earned_coin) from public.coin_leaderboard_test_events) as min_saved_daily_coin,
  (select max(earned_coin) from public.coin_leaderboard_test_events) as max_saved_daily_coin,
  (
    select count(*)
      from public.coin_leaderboard_test_events
      where earned_on = (now() at time zone 'Asia/Jakarta')::date
  ) as today_saved_event_count;
