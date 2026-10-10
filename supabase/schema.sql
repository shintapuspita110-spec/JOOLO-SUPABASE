create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

alter table public.profiles enable row level security;
grant usage on schema public to authenticated;
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;

create table if not exists public.challenge_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.challenge_settings enable row level security;
revoke all on table public.challenge_settings from public, anon, authenticated;
grant select, insert, update on table public.challenge_settings to authenticated;

drop policy if exists "Users can read their own challenge settings" on public.challenge_settings;
create policy "Users can read their own challenge settings"
  on public.challenge_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own challenge settings" on public.challenge_settings;
create policy "Users can create their own challenge settings"
  on public.challenge_settings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own challenge settings" on public.challenge_settings;
create policy "Users can update their own challenge settings"
  on public.challenge_settings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into public.challenge_settings (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create table if not exists public.phase_daily_quests (
  id text primary key,
  phase_category_id text not null,
  phase_name text not null,
  day_number smallint not null check (day_number between 1 and 40),
  focus text not null,
  cover_image text not null default 'auto_match',
  task_name text not null,
  short_description text not null,
  frequency text not null,
  level text not null check (level in ('Easy', 'Medium', 'Hard')),
  target text not null,
  total_coin integer not null check (total_coin >= 0),
  skill_category_id text not null,
  soft_skills text not null,
  max_possible_coin integer not null check (max_possible_coin >= 0),
  coin_user integer,
  percentage_rule text,
  created_at timestamptz not null default now(),
  unique (phase_category_id, day_number, task_name)
);

alter table public.phase_daily_quests enable row level security;
revoke all on table public.phase_daily_quests from public, anon, authenticated;
grant select on table public.phase_daily_quests to authenticated;

drop policy if exists "Authenticated users can read phase daily quests" on public.phase_daily_quests;
create policy "Authenticated users can read phase daily quests"
  on public.phase_daily_quests
  for select
  to authenticated
  using (true);

insert into public.phase_daily_quests (
  id, phase_category_id, phase_name, day_number, focus, cover_image, task_name,
  short_description, frequency, level, target, total_coin, skill_category_id,
  soft_skills, max_possible_coin, coin_user, percentage_rule
)
values
  ('phase-01-day-01-morning-mindful-breathing', 'PHASE_01', 'Awakening', 1, 'Pemetaan Kondisi & Identitas Saat Ini', 'auto_match', 'Morning Mindful Breathing', 'Lakukan pernapasan sadar (deep breathing) selama 5 menit setelah bangun tidur', 'One-Time', 'Easy', '5 menit', 10, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 20, null, 'total coin yang didapatkan/max_possible_coin*100'),
  ('phase-01-day-01-core-values-declaration', 'PHASE_01', 'Awakening', 1, 'Pemetaan Kondisi & Identitas Saat Ini', 'auto_match', 'Core Values Declaration', 'Tuliskan 3 nilai hidup teratas yang paling penting saat ini', 'One-Time', 'Easy', '3 nilai', 10, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 20, null, null),
  ('phase-01-day-01-habit-audit-7-hari-terakhir', 'PHASE_01', 'Awakening', 1, 'Pemetaan Kondisi & Identitas Saat Ini', 'auto_match', 'Habit Audit 7 Hari Terakhir', 'Catat minimal 5 kebiasaan dominan (baik/buruk) seminggu ke belakang', 'One-Time', 'Medium', '5 kebiasaan', 20, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 30, null, null),
  ('phase-01-day-01-energy-leak-identification', 'PHASE_01', 'Awakening', 1, 'Pemetaan Kondisi & Identitas Saat Ini', 'auto_match', 'Energy Leak Identification', 'Identifikasi dan tuliskan 2 aktivitas utama yang paling banyak menguras energi', 'One-Time', 'Medium', '2 aktivitas', 20, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 30, null, null),
  ('phase-01-day-01-the-identity-shift-statement', 'PHASE_01', 'Awakening', 1, 'Pemetaan Kondisi & Identitas Saat Ini', 'auto_match', 'The Identity Shift Statement', 'Tuliskan 1 paragraf narasi deskripsi diri di hari ke-40 (present tense)', 'One-Time', 'Hard', '1 paragraf', 30, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 40, null, null),
  ('phase-01-day-02-hydration-water-check', 'PHASE_01', 'Awakening', 2, 'Pelacakan Waktu & Pemicu Distraksi', 'auto_match', 'Hydration & Water Check', 'Minum air putih minimal 500 ml segera setelah bangun tidur', 'One-Time', 'Easy', '500 ml', 10, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 20, null, null),
  ('phase-01-day-02-digital-screen-time-check', 'PHASE_01', 'Awakening', 2, 'Pelacakan Waktu & Pemicu Distraksi', 'auto_match', 'Digital Screen-Time Check', 'Cek durasi 1 screen-time di smartphone dan catat aplikasi tertinggi', 'One-Time', 'Easy', '1 aplikasi', 10, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 20, null, null),
  ('phase-01-day-02-distraction-trigger-log', 'PHASE_01', 'Awakening', 2, 'Pelacakan Waktu & Pemicu Distraksi', 'auto_match', 'Distraction Trigger Log', 'Catat minimal 3 pemicu eksternal/internal utama yang mengalihkan fokus', 'One-Time', 'Medium', '3 pemicu', 20, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 30, null, null),
  ('phase-01-day-02-time-block-awareness', 'PHASE_01', 'Awakening', 2, 'Pelacakan Waktu & Pemicu Distraksi', 'auto_match', 'Time Block Awareness', 'Tuliskan alokasi waktu aktual untuk 3 aktivitas terbesar hari ini', 'One-Time', 'Medium', '3 aktivitas', 20, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 30, null, null),
  ('phase-01-day-02-uncompromising-digital-purge', 'PHASE_01', 'Awakening', 2, 'Pelacakan Waktu & Pemicu Distraksi', 'auto_match', 'Uncompromising Digital Purge', 'Hapus atau unfollow minimal 5 akun medsos/aplikasi destruktif', 'One-Time', 'Hard', '5 akun', 30, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 40, null, null),
  ('phase-01-day-03-daily-gratitude-notes', 'PHASE_01', 'Awakening', 3, 'Menemukan "The Deep Why" & Peta Emosi', 'auto_match', 'Daily Gratitude Notes', 'Tuliskan 3 hal kecil yang disyukuri pagi ini di buku jurnal', 'One-Time', 'Easy', '3 hal', 10, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 20, null, null),
  ('phase-01-day-03-emotional-state-check-in', 'PHASE_01', 'Awakening', 3, 'Menemukan "The Deep Why" & Peta Emosi', 'auto_match', 'Emotional State Check-In', 'Beri label pada 1 suasana hati saat ini beserta alasannya', 'One-Time', 'Easy', '1 label', 10, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 20, null, null),
  ('phase-01-day-03-past-failure-reflection', 'PHASE_01', 'Awakening', 3, 'Menemukan "The Deep Why" & Peta Emosi', 'auto_match', 'Past Failure Reflection', 'Tuliskan 1 kegagalan masa lalu dan 1 pelajaran berharga darinya', 'One-Time', 'Medium', '1 pelajaran', 20, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 30, null, null),
  ('phase-01-day-03-body-tension-scan', 'PHASE_01', 'Awakening', 3, 'Menemukan "The Deep Why" & Peta Emosi', 'auto_match', 'Body Tension Scan', 'Lakukan relaksasi otot dan peregangan ringan selama 10 menit', 'One-Time', 'Medium', '10 menit', 20, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 30, null, null),
  ('phase-01-day-03-the-5-whys-root-cause-analysis', 'PHASE_01', 'Awakening', 3, 'Menemukan "The Deep Why" & Peta Emosi', 'auto_match', 'The 5 Whys Root Cause Analysis', 'Telusuri akar masalah hambatan dengan bertanya "Mengapa?" sebanyak 5 kali', 'One-Time', 'Hard', '5 kali tanya', 30, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 40, null, null),
  ('phase-01-day-04-physical-space-reset', 'PHASE_01', 'Awakening', 4, 'Pembersihan Lingkungan & Transisi Fase', 'auto_match', 'Physical Space Reset', 'Rapikan 1 tempat tidur segera setelah bangun tidur tanpa menunda', 'One-Time', 'Easy', '1 tempat tidur', 10, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 20, null, null),
  ('phase-01-day-04-inbox-notification-cleanse', 'PHASE_01', 'Awakening', 4, 'Pembersihan Lingkungan & Transisi Fase', 'auto_match', 'Inbox & Notification Cleanse', 'Hapus/bersihkan minimal 10 pesan/notifikasi junk atau email', 'One-Time', 'Easy', '10 pesan', 10, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 20, null, null),
  ('phase-01-day-04-workspace-deep-clean', 'PHASE_01', 'Awakening', 4, 'Pembersihan Lingkungan & Transisi Fase', 'auto_match', 'Workspace Deep Clean', 'Bersihkan dan tata ulang 1 meja kerja atau meja belajar', 'One-Time', 'Medium', '1 meja kerja', 20, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 30, null, null),
  ('phase-01-day-04-core-strength-and-weakness-review', 'PHASE_01', 'Awakening', 4, 'Pembersihan Lingkungan & Transisi Fase', 'auto_match', 'Core Strength & Weakness Review', 'Buat daftar 4 poin (2 kekuatan terbesar & 2 kelemahan diri)', 'One-Time', 'Medium', '4 poin', 20, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 30, null, null),
  ('phase-01-day-04-phase-1-reflection-essay', 'PHASE_01', 'Awakening', 4, 'Pembersihan Lingkungan & Transisi Fase', 'auto_match', 'Phase 1 Reflection Essay', 'Tulis jurnal refleksi penutup Fase 1 minimal 200 kata', 'One-Time', 'Hard', '200 kata', 30, 'SKILL_01', 'Self-Awareness, Emotional Regulation, & Personal Accountability', 40, null, null),
  ('phase-02-day-05-early-wake-up-anchor', 'PHASE_02', 'Reprogramming', 5, 'Membangun Mikro-Rutinitas Pagi', 'auto_match', 'Early Wake-Up Anchor', 'Bangun tepat waktu tanpa tombol snooze alarm untuk 1 waktu', 'One-Time', 'Easy', '1 waktu', 10, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 20, null, null),
  ('phase-02-day-05-no-phone-first-30-minutes', 'PHASE_02', 'Reprogramming', 5, 'Membangun Mikro-Rutinitas Pagi', 'auto_match', 'No-Phone First 30 Minutes', 'Hindari medsos atau pesan kerja selama 30 menit pertama bangun tidur', 'One-Time', 'Easy', '30 menit', 10, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 20, null, null),
  ('phase-02-day-05-micro-habit-stacking-setup', 'PHASE_02', 'Reprogramming', 5, 'Membangun Mikro-Rutinitas Pagi', 'auto_match', 'Micro-Habit Stacking Setup', 'Tuliskan 1 kebiasaan baru yang disambung ke kebiasaan lama', 'One-Time', 'Medium', '1 kebiasaan', 20, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 30, null, null),
  ('phase-02-day-05-focused-work-block-pomodoro', 'PHASE_02', 'Reprogramming', 5, 'Membangun Mikro-Rutinitas Pagi', 'auto_match', 'Focused Work Block (Pomodoro)', 'Selesaikan sesi kerja mendalam selama 2 siklus (50 menit) tanpa distraksi', 'One-Time', 'Medium', '2 siklus (50 menit)', 20, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 30, null, null),
  ('phase-02-day-05-the-temptation-bundling-design', 'PHASE_02', 'Reprogramming', 5, 'Membangun Mikro-Rutinitas Pagi', 'auto_match', 'The Temptation Bundling Design', 'Rancang 1 sistem penghargaan yang menggabungkan tugas dan kesukaan', 'One-Time', 'Hard', '1 sistem', 30, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 40, null, null),
  ('phase-02-day-06-hydration-electrolyte-check', 'PHASE_02', 'Reprogramming', 6, 'Manajemen Distraksi & Lingkungan', 'auto_match', 'Hydration & Electrolyte Check', 'Minum air putih minimal 1 liter sebelum pukul 12 siang', 'One-Time', 'Easy', '1 liter', 10, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 20, null, null),
  ('phase-02-day-06-digital-notification-lockdown', 'PHASE_02', 'Reprogramming', 6, 'Manajemen Distraksi & Lingkungan', 'auto_match', 'Digital Notification Lockdown', 'Aktifkan 1 mode Do Not Disturb / Focus Mode di smartphone', 'One-Time', 'Easy', '1 mode aktif', 10, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 20, null, null),
  ('phase-02-day-06-distraction-interruption-log', 'PHASE_02', 'Reprogramming', 6, 'Manajemen Distraksi & Lingkungan', 'auto_match', 'Distraction Interruption Log', 'Catat pemicu distraksi dan beri jeda 10 detik setiap teralihkan', 'One-Time', 'Medium', '10 detik jeda', 20, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 30, null, null),
  ('phase-02-day-06-single-tasking-commitment', 'PHASE_02', 'Reprogramming', 6, 'Manajemen Distraksi & Lingkungan', 'auto_match', 'Single-Tasking Commitment', 'Kerjakan tugas utama secara single-tasking selama 60 menit penuh', 'One-Time', 'Medium', '60 menit', 20, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 30, null, null),
  ('phase-02-day-06-the-48-hour-dopamine-fast-experiment', 'PHASE_02', 'Reprogramming', 6, 'Manajemen Distraksi & Lingkungan', 'auto_match', 'The 48-Hour Dopamine Fast Experiment', 'Lakukan 1 sesi puasa hiburan instan selama sisa hari setelah bekerja', 'One-Time', 'Hard', '1 sesi', 30, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 40, null, null),
  ('phase-02-day-07-weekly-habit-tracker-review', 'PHASE_02', 'Reprogramming', 7, 'Evaluasi Sistem & Konsistensi Mingguan', 'auto_match', 'Weekly Habit Tracker Review', 'Hitung persentase keberhasilan dari 6 hari misi yang telah dilalui', 'One-Time', 'Easy', '6 hari', 10, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 20, null, null),
  ('phase-02-day-07-physical-movement-reset', 'PHASE_02', 'Reprogramming', 7, 'Evaluasi Sistem & Konsistensi Mingguan', 'auto_match', 'Physical Movement Reset', 'Lakukan peregangan otot atau jalan kaki santai selama 15 menit', 'One-Time', 'Easy', '15 menit', 10, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 20, null, null),
  ('phase-02-day-07-friction-audit', 'PHASE_02', 'Reprogramming', 7, 'Evaluasi Sistem & Konsistensi Mingguan', 'auto_match', 'Friction Audit', 'Tuliskan 1 hambatan atau titik gesekan terbesar selama seminggu', 'One-Time', 'Medium', '1 hambatan', 20, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 30, null, null),
  ('phase-02-day-07-habit-tweaking-and-optimization', 'PHASE_02', 'Reprogramming', 7, 'Evaluasi Sistem & Konsistensi Mingguan', 'auto_match', 'Habit Tweaking & Optimization', 'Modifikasi 1 target misi agar lebih realistis untuk minggu depan', 'One-Time', 'Medium', '1 penyesuaian', 20, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 30, null, null),
  ('phase-02-day-07-phase-2-commitment-renewal', 'PHASE_02', 'Reprogramming', 7, 'Evaluasi Sistem & Konsistensi Mingguan', 'auto_match', 'Phase 2 Commitment Renewal', 'Tuliskan kontrak komitmen pribadi minimal 150 kata untuk Fase 3', 'One-Time', 'Hard', '150 kata', 30, 'SKILL_02', 'System Thinking, Discipline, & Operational Efficiency', 40, null, null),
  ('phase-03-day-08-morning-focus-intentions', 'PHASE_03', 'Focus & Discipline', 8, 'Pengenalan Deep Work & Time Boxing', 'auto_match', 'Morning Focus Intentions', 'Tuliskan 3 prioritas utama (MIT) sebelum membuka aplikasi komunikasi', 'One-Time', 'Easy', '3 prioritas', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-08-hydration-posture-check', 'PHASE_03', 'Focus & Discipline', 8, 'Pengenalan Deep Work & Time Boxing', 'auto_match', 'Hydration & Posture Check', 'Sesuaikan posisi duduk tegak dan minum air setiap transisi blok waktu', 'One-Time', 'Easy', '1 gelas air', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-08-time-boxing-schedule', 'PHASE_03', 'Focus & Discipline', 8, 'Pengenalan Deep Work & Time Boxing', 'auto_match', 'Time Boxing Schedule', 'Bagi jadwal harian ke dalam blok waktu spesifik di kalender/catatan', 'One-Time', 'Medium', '1 jadwal blok', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-08-single-session-deep-work-60-min', 'PHASE_03', 'Focus & Discipline', 8, 'Pengenalan Deep Work & Time Boxing', 'auto_match', 'Single-Session Deep Work (60 Min)', 'Selesaikan pekerjaan berat selama 60 menit penuh tanpa beralih tab/medsos', 'One-Time', 'Medium', '60 menit', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-08-phone-free-working-zone', 'PHASE_03', 'Focus & Discipline', 8, 'Pengenalan Deep Work & Time Boxing', 'auto_match', 'The Phone-Free Working Zone', 'Letakkan smartphone di ruangan berbeda atau laci tertutup selama kerja', 'One-Time', 'Hard', '1 zona bebas HP', 30, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 40, null, null),
  ('phase-03-day-09-2-minute-rule-execution', 'PHASE_03', 'Focus & Discipline', 9, 'Mengatasi Penundaan (Task Initiation)', 'auto_match', '2-Minute Rule Execution', 'Langsung kerjakan tugas kecil yang memakan waktu kurang dari 2 menit', 'One-Time', 'Easy', '2 menit', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-09-micro-break-stretching', 'PHASE_03', 'Focus & Discipline', 9, 'Mengatasi Penundaan (Task Initiation)', 'auto_match', 'Micro-Break Stretching', 'Lakukan peregangan fisik selama 5 menit setiap selesai satu blok tugas', 'One-Time', 'Easy', '5 menit', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-09-5-second-rule-activation', 'PHASE_03', 'Focus & Discipline', 9, 'Mengatasi Penundaan (Task Initiation)', 'auto_match', 'The 5-Second Rule Activation', 'Hitung mundur (5-1) lalu langsung bertindak saat merasa enggan menunda', 'One-Time', 'Medium', '5 detik hitung', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-09-task-deconstruction', 'PHASE_03', 'Focus & Discipline', 9, 'Mengatasi Penundaan (Task Initiation)', 'auto_match', 'Task Deconstruction', 'Pecah 1 tugas besar/menakutkan menjadi 3 langkah mikro yang mudah', 'One-Time', 'Medium', '3 langkah mikro', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-09-eat-that-frog-first', 'PHASE_03', 'Focus & Discipline', 9, 'Mengatasi Penundaan (Task Initiation)', 'auto_match', 'Eat That Frog First', 'Selesaikan tugas paling sulit dan dihindari terlebih dahulu di pagi hari', 'One-Time', 'Hard', '1 tugas utama', 30, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 40, null, null),
  ('phase-03-day-10-energy-peak-mapping', 'PHASE_03', 'Focus & Discipline', 10, 'Manajemen Energi & Perhatian', 'auto_match', 'Energy Peak Mapping', 'Catat jam berapa saja energi mental berada di titik tertinggi dan terendah', 'One-Time', 'Easy', '2 titik energi', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-10-mindful-breathing-reset', 'PHASE_03', 'Focus & Discipline', 10, 'Manajemen Energi & Perhatian', 'auto_match', 'Mindful Breathing Reset', 'Lakukan teknik pernapasan kotak (box breathing) selama 3 menit', 'One-Time', 'Easy', '3 menit', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-10-strategic-rest-block', 'PHASE_03', 'Focus & Discipline', 10, 'Manajemen Energi & Perhatian', 'auto_match', 'Strategic Rest Block', 'Ambil istirahat total tanpa layar (screen-free break) selama 15 menit', 'One-Time', 'Medium', '15 menit', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-10-high-energy-task-alignment', 'PHASE_03', 'Focus & Discipline', 10, 'Manajemen Energi & Perhatian', 'auto_match', 'High-Energy Task Alignment', 'Sesuaikan jadwal tugas tersulit tepat pada jam puncak energi Anda hari ini', 'One-Time', 'Medium', '1 jadwal pas', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-10-complete-digital-shutdown', 'PHASE_03', 'Focus & Discipline', 10, 'Manajemen Energi & Perhatian', 'auto_match', 'Complete Digital Shutdown', 'Matikan seluruh perangkat kerja dan notifikasi 1 jam sebelum tidur', 'One-Time', 'Hard', '1 jam sebelum tidur', 30, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 40, null, null),
  ('phase-03-day-11-single-tab-browser-rule', 'PHASE_03', 'Focus & Discipline', 11, 'Konsentrasi Total & Pemangkasan Multitasking', 'auto_match', 'Single-Tab Browser Rule', 'Buka maksimal 2 tab browser yang berkaitan langsung dengan tugas', 'One-Time', 'Easy', '2 tab browser', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-11-zero-notification-hour', 'PHASE_03', 'Focus & Discipline', 11, 'Konsentrasi Total & Pemangkasan Multitasking', 'auto_match', 'Zero-Notification Hour', 'Aktifkan mode Do Not Disturb selama 1 jam penuh di sore hari', 'One-Time', 'Easy', '1 jam DND', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-11-context-switching-audit', 'PHASE_03', 'Focus & Discipline', 11, 'Konsentrasi Total & Pemangkasan Multitasking', 'auto_match', 'Context-Switching Audit', 'Catat seberapa sering Anda berpindah aplikasi/tugas dalam 2 jam kerja', 'One-Time', 'Medium', '2 jam audit', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-11-dual-pomodoro-flow', 'PHASE_03', 'Focus & Discipline', 11, 'Konsentrasi Total & Pemangkasan Multitasking', 'auto_match', 'Dual Pomodoro Flow', 'Selesaikan 2 sesi Pomodoro berturut-turut (total 50 menit kerja)', 'One-Time', 'Medium', '2 sesi (50 menit)', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-11-the-monotasking-challenge', 'PHASE_03', 'Focus & Discipline', 11, 'Konsentrasi Total & Pemangkasan Multitasking', 'auto_match', 'The Monotasking Challenge', 'Jalankan 1 tugas utama selama 90 menit penuh tanpa pindah konteks sama sekali', 'One-Time', 'Hard', '90 menit fokus', 30, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 40, null, null),
  ('phase-03-day-12-morning-intention-declaration', 'PHASE_03', 'Focus & Discipline', 12, 'Disiplin Melawan Kelelahan Mental', 'auto_match', 'Morning Intention Declaration', 'Ucapkan atau tuliskan kalimat komitmen disiplin harian di awal hari', 'One-Time', 'Easy', '1 kalimat', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-12-workspace-clutter-check', 'PHASE_03', 'Focus & Discipline', 12, 'Disiplin Melawan Kelelahan Mental', 'auto_match', 'Workspace Clutter Check', 'Pastikan meja kerja bersih dari barang tidak terpakai sebelum beraktivitas', 'One-Time', 'Easy', '1 meja bersih', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-12-friction-removal', 'PHASE_03', 'Focus & Discipline', 12, 'Disiplin Melawan Kelelahan Mental', 'auto_match', 'Friction Removal', 'Siapkan alat, dokumen, atau file yang dibutuhkan esok hari sejak malam', 'One-Time', 'Medium', '1 set persiapan', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-12-resistance-breakthrough', 'PHASE_03', 'Focus & Discipline', 12, 'Disiplin Melawan Kelelahan Mental', 'auto_match', 'Resistance Breakthrough', 'Paksa diri melanjutkan tugas selama 10 menit pertama saat rasa malas menyerang', 'One-Time', 'Medium', '10 menit awal', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-12-accountability-self-audit', 'PHASE_03', 'Focus & Discipline', 12, 'Disiplin Melawan Kelelahan Mental', 'auto_match', 'Accountability Self-Audit', 'Tulis evaluasi jujur tentang sejauh mana menepati janji diri (min. 100 kata)', 'One-Time', 'Hard', '100 kata', 30, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 40, null, null),
  ('phase-03-day-13-hydration-focus-fuel', 'PHASE_03', 'Focus & Discipline', 13, 'Ketahanan Perhatian & Ketekunan', 'auto_match', 'Hydration & Focus Fuel', 'Penuhi target minum air dan hindari gula berlebih pemicu kelelahan energi', 'One-Time', 'Easy', '1 target air', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-13-distraction-catching', 'PHASE_03', 'Focus & Discipline', 13, 'Ketahanan Perhatian & Ketekunan', 'auto_match', 'Distraction Catching', 'Tulis di secarik kertas setiap pikiran melayang saat bekerja, lalu kembali fokus', 'One-Time', 'Easy', '1 catatan kertas', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-13-extended-deep-work-90-min', 'PHASE_03', 'Focus & Discipline', 13, 'Ketahanan Perhatian & Ketekunan', 'auto_match', 'Extended Deep Work (90 Min)', 'Tingkatkan durasi sesi kerja mendalam menjadi 90 menit tanpa jeda interupsi', 'One-Time', 'Medium', '90 menit kerja', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-13-evening-brain-dump', 'PHASE_03', 'Focus & Discipline', 13, 'Ketahanan Perhatian & Ketekunan', 'auto_match', 'Evening Brain Dump', 'Tuliskan semua ide/rencana besok ke buku catatan agar kepala rileks', 'One-Time', 'Medium', '1 sesi catat', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-13-the-zero-distraction-afternoon', 'PHASE_03', 'Focus & Discipline', 13, 'Ketahanan Perhatian & Ketekunan', 'auto_match', 'The Zero-Distraction Afternoon', 'Bekerja di tempat sunyi tanpa akses internet bebas selama 2 jam penuh', 'One-Time', 'Hard', '2 jam offline', 30, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 40, null, null),
  ('phase-03-day-14-phase-3-progress-check', 'PHASE_03', 'Focus & Discipline', 14, 'Evaluasi Paruh Jalan & Penguatan Disiplin', 'auto_match', 'Phase 3 Progress Check', 'Hitung tingkat penyelesaian misi yang sudah dikerjakan dari Hari 8-13', 'Weekly', 'Easy', '6 hari evaluasi', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-14-physical-and-mental-recovery', 'PHASE_03', 'Focus & Discipline', 14, 'Evaluasi Paruh Jalan & Penguatan Disiplin', 'auto_match', 'Physical & Mental Recovery', 'Lakukan jalan santai di luar ruangan selama 20 menit untuk menyegarkan otak', 'One-Time', 'Easy', '20 menit jalan', 10, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 20, null, null),
  ('phase-03-day-14-focus-bottleneck-analysis', 'PHASE_03', 'Focus & Discipline', 14, 'Evaluasi Paruh Jalan & Penguatan Disiplin', 'auto_match', 'Focus Bottleneck Analysis', 'Identifikasi hambatan terbesar yang masih merusak konsentrasi minggu ini', 'One-Time', 'Medium', '1 hambatan utama', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-14-system-optimization', 'PHASE_03', 'Focus & Discipline', 14, 'Evaluasi Paruh Jalan & Penguatan Disiplin', 'auto_match', 'System Optimization', 'Sesuaikan durasi atau aturan Deep Work agar pas dengan kapasitas nyata Anda', 'One-Time', 'Medium', '1 optimasi sistem', 20, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 30, null, null),
  ('phase-03-day-14-phase-3-reflection-and-transition-essay', 'PHASE_03', 'Focus & Discipline', 14, 'Evaluasi Paruh Jalan & Penguatan Disiplin', 'auto_match', 'Phase 3 Reflection & Transition Essay', 'Tulis esai refleksi mini minimal 150 kata tentang kedisiplinan dan waktu', 'One-Time', 'Hard', '150 kata', 30, 'SKILL_03', 'Focus Mastery, Task Initiation, & Time Management', 40, null, null),
  ('phase-04-day-15-morning-emotional-check-in', 'PHASE_04', 'Emotional Mastery', 15, 'Pemetaan Kesadaran Emosi (Emotional Audit)', 'auto_match', 'Morning Emotional Check-In', 'Tuliskan label emosi utama yang dirasakan pagi ini di jurnal', 'One-Time', 'Easy', '1 label emosi', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-15-body-emotion-scan', 'PHASE_04', 'Emotional Mastery', 15, 'Pemetaan Kesadaran Emosi (Emotional Audit)', 'auto_match', 'Body Emotion Scan', 'Amati bagian tubuh yang terasa tegang saat memikirkan hari ini selama 3 menit', 'One-Time', 'Easy', '3 menit', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-15-emotional-trigger-log', 'PHASE_04', 'Emotional Mastery', 15, 'Pemetaan Kesadaran Emosi (Emotional Audit)', 'auto_match', 'Emotional Trigger Log', 'Catat minimal 1 kejadian hari ini yang memicu perubahan suasana hati drastis', 'One-Time', 'Medium', '1 kejadian', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-15-pause-between-stimulus-and-response', 'PHASE_04', 'Emotional Mastery', 15, 'Pemetaan Kesadaran Emosi (Emotional Audit)', 'auto_match', 'The Pause Between Stimulus & Response', 'Lakukan jeda bernapas selama 10 detik setiap kali merasa tersinggung', 'One-Time', 'Medium', '10 detik jeda', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-15-emotional-vulnerability-journaling', 'PHASE_04', 'Emotional Mastery', 15, 'Pemetaan Kesadaran Emosi (Emotional Audit)', 'auto_match', 'Emotional Vulnerability Journaling', 'Tuliskan satu ketakutan atau rasa insecure terbesar selama ini minimal 150 kata', 'One-Time', 'Hard', '150 kata', 30, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 40, null, null),
  ('phase-04-day-16-morning-grounding-exercise', 'PHASE_04', 'Emotional Mastery', 16, 'Regulasi Stres & Pernapasan Sadar (Mindfulness)', 'auto_match', 'Morning Grounding Exercise', 'Lakukan teknik 5-4-3-2-1 Grounding untuk kembali sadar ke masa kini', 'One-Time', 'Easy', '1 teknik (5 langkah)', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-16-hydration-and-calm-sip', 'PHASE_04', 'Emotional Mastery', 16, 'Regulasi Stres & Pernapasan Sadar (Mindfulness)', 'auto_match', 'Hydration & Calm Sip', 'Minum segelas air hangat perlahan sambil fokus pada rasa tenang', 'One-Time', 'Easy', '1 gelas air hangat', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-16-box-breathing-session', 'PHASE_04', 'Emotional Mastery', 16, 'Regulasi Stres & Pernapasan Sadar (Mindfulness)', 'auto_match', 'Box Breathing Session', 'Lakukan teknik pernapasan kotak berturut-turut selama 5 menit', 'One-Time', 'Medium', '5 menit', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-16-stress-release-walking', 'PHASE_04', 'Emotional Mastery', 16, 'Regulasi Stres & Pernapasan Sadar (Mindfulness)', 'auto_match', 'Stress Release Walking', 'Berjalan kaki santai di luar ruangan tanpa gadget selama 15 menit', 'One-Time', 'Medium', '15 menit jalan', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-16-radical-acceptance-practice', 'PHASE_04', 'Emotional Mastery', 16, 'Regulasi Stres & Pernapasan Sadar (Mindfulness)', 'auto_match', 'Radical Acceptance Practice', 'Tuliskan pernyataan penerimaan total untuk satu situasi di luar kendali', 'One-Time', 'Hard', '1 pernyataan tertulis', 30, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 40, null, null),
  ('phase-04-day-17-morning-positive-affirmation', 'PHASE_04', 'Emotional Mastery', 17, 'Menghadapi Pikiran Negatif (Cognitive Reframing)', 'auto_match', 'Morning Positive Affirmation', 'Ucapkan atau tuliskan 3 kalimat penguatan positif untuk diri sendiri', 'One-Time', 'Easy', '3 kalimat positif', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-17-mindful-tea-coffee-break', 'PHASE_04', 'Emotional Mastery', 17, 'Menghadapi Pikiran Negatif (Cognitive Reframing)', 'auto_match', 'Mindful Tea/Coffee Break', 'Nikmati minuman pagi tanpa gadget, benar-benar meresapi rasa & aroma', 'One-Time', 'Easy', '1 cangkir tanpa gadget', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-17-negative-thought-catching', 'PHASE_04', 'Emotional Mastery', 17, 'Menghadapi Pikiran Negatif (Cognitive Reframing)', 'auto_match', 'Negative Thought Catching', 'Catat minimal 2 asumsi negatif atau overthinking yang muncul hari ini', 'One-Time', 'Medium', '2 asumsi negatif', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-17-cognitive-reframing', 'PHASE_04', 'Emotional Mastery', 17, 'Menghadapi Pikiran Negatif (Cognitive Reframing)', 'auto_match', 'Cognitive Reframing', 'Ubah 2 pikiran negatif menjadi sudut pandang rasional & memberdayakan', 'One-Time', 'Medium', '2 sudut pandang', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-17-inner-critic-dialogue', 'PHASE_04', 'Emotional Mastery', 17, 'Menghadapi Pikiran Negatif (Cognitive Reframing)', 'auto_match', 'The Inner Critic Dialogue', 'Tulis dialog imajiner antara suara penghakiman dan sahabat bijak', 'One-Time', 'Hard', '1 dialog imajiner', 30, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 40, null, null),
  ('phase-04-day-18-social-media-emotional-audit', 'PHASE_04', 'Emotional Mastery', 18, 'Batasan Emosional & Energi Sosial (Emotional Boundaries)', 'auto_match', 'Social Media Emotional Audit', 'Hindari atau mute akun/grup chat pemicu insecure, iri, atau marah', 'One-Time', 'Easy', '1 aksi mute/hindari', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-18-gratitude-for-small-mercies', 'PHASE_04', 'Emotional Mastery', 18, 'Batasan Emosional & Energi Sosial (Emotional Boundaries)', 'auto_match', 'Gratitude for Small Mercies', 'Tuliskan 3 hal kecil yang membuat hati merasa hangat atau tersenyum hari ini', 'One-Time', 'Easy', '3 hal kecil', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-18-energy-vampire-identification', 'PHASE_04', 'Emotional Mastery', 18, 'Batasan Emosional & Energi Sosial (Emotional Boundaries)', 'auto_match', 'Energy Vampire Identification', 'Identifikasi 1 interaksi/situasi sosial penyedot ketenangan emosional', 'One-Time', 'Medium', '1 situasi sosial', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-18-setting-a-gentle-boundary', 'PHASE_04', 'Emotional Mastery', 18, 'Batasan Emosional & Energi Sosial (Emotional Boundaries)', 'auto_match', 'Setting a Gentle Boundary', 'Berlatih mengatakan tidak dengan sopan pada 1 hal kecil yang tidak diinginkan', 'One-Time', 'Medium', '1 penolakan sopan', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-18-emotional-detox-writing', 'PHASE_04', 'Emotional Mastery', 18, 'Batasan Emosional & Energi Sosial (Emotional Boundaries)', 'auto_match', 'Emotional Detox Writing', 'Tulis surat emosional untuk situasi masa lalu, lalu robek/hapus sebagai pelepasan', 'One-Time', 'Hard', '1 surat emosional', 30, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 40, null, null),
  ('phase-04-day-19-mental-fatigue-check', 'PHASE_04', 'Emotional Mastery', 19, 'Mengatasi Kejenuhan & Burnout', 'auto_match', 'Mental Fatigue Check', 'Nilai tingkat kelelahan mental pada skala 1-10 di pagi hari', 'One-Time', 'Easy', 'Skala 1-10', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-19-digital-sunset-preparation', 'PHASE_04', 'Emotional Mastery', 19, 'Mengatasi Kejenuhan & Burnout', 'auto_match', 'Digital Sunset Preparation', 'Matikan semua layar gadget 45 menit lebih awal sebelum waktu tidur malam', 'One-Time', 'Easy', '45 menit sebelum tidur', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-19-self-compassion-break', 'PHASE_04', 'Emotional Mastery', 19, 'Mengatasi Kejenuhan & Burnout', 'auto_match', 'Self-Compassion Break', 'Berikan apresiasi atau pelukan hangat pada diri atas perjuangan hingga hari ke-19', 'One-Time', 'Medium', '1 sesi apresiasi', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-19-permission-to-rest', 'PHASE_04', 'Emotional Mastery', 19, 'Mengatasi Kejenuhan & Burnout', 'auto_match', 'Permission to Rest', 'Ambil jeda istirahat total selama 30 menit di siang hari tanpa rasa bersalah', 'One-Time', 'Medium', '30 menit istirahat', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-19-burnout-prevention-plan', 'PHASE_04', 'Emotional Mastery', 19, 'Mengatasi Kejenuhan & Burnout', 'auto_match', 'The Burnout Prevention Plan', 'Buat aturan batas kerja pribadi (jam berhenti tegas) untuk cegah kelelahan', 'One-Time', 'Hard', '1 aturan batas kerja', 30, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 40, null, null),
  ('phase-04-day-20-morning-forgiveness-intentions', 'PHASE_04', 'Emotional Mastery', 20, 'Pengampunan & Pelepasan Beban Masa Lalu', 'auto_match', 'Morning Forgiveness Intentions', 'Niatkan dalam hati melepaskan 1 kekecewaan kecil tersisa dari masa lalu', 'One-Time', 'Easy', '1 niat pelepasan', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-20-mirror-work-self-kindness', 'PHASE_04', 'Emotional Mastery', 20, 'Pengampunan & Pelepasan Beban Masa Lalu', 'auto_match', 'Mirror Work (Self-Kindness)', 'Tatap cermin selama 1 menit dan katakan kalimat pemaafan diri', 'One-Time', 'Easy', '1 menit cermin', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-20-unresolved-grievance-log', 'PHASE_04', 'Emotional Mastery', 20, 'Pengampunan & Pelepasan Beban Masa Lalu', 'auto_match', 'Unresolved Grievance Log', 'Tulis daftar ekspektasi masa lalu yang belum tercapai lalu ikhlas lepaskan', 'One-Time', 'Medium', '1 daftar ekspektasi', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-20-apology-to-self', 'PHASE_04', 'Emotional Mastery', 20, 'Pengampunan & Pelepasan Beban Masa Lalu', 'auto_match', 'Apology to Self', 'Tulis surat permintaan maaf kepada diri karena mengabaikan kesehatan', 'One-Time', 'Medium', '1 surat permintaan maaf', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-20-the-release-ritual', 'PHASE_04', 'Emotional Mastery', 20, 'Pengampunan & Pelepasan Beban Masa Lalu', 'auto_match', 'The Release Ritual', 'Tulis beban mental terberat di kertas, renungkan, lalu hancurkan sebagai simbol bebas', 'One-Time', 'Hard', '1 ritual hancurkan kertas', 30, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 40, null, null),
  ('phase-04-day-21-day-21-milestone-celebration', 'PHASE_04', 'Emotional Mastery', 21, 'Evaluasi Paruh Tantangan & Keseimbangan Batin', 'auto_match', 'Day 21 Milestone Celebration', 'Berikan hadiah kecil non-material untuk diri karena bertahan sampai separuh jalan', 'Weekly', 'Easy', '1 bentuk hadiah non-material', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-21-emotional-growth-review', 'PHASE_04', 'Emotional Mastery', 21, 'Evaluasi Paruh Tantangan & Keseimbangan Batin', 'auto_match', 'Emotional Growth Review', 'Tinjau kembali seberapa jauh perubahan cara merespons emosi dari Hari 1', 'One-Time', 'Easy', '1 review perubahan', 10, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 20, null, null),
  ('phase-04-day-21-emotional-stability-mapping', 'PHASE_04', 'Emotional Mastery', 21, 'Evaluasi Paruh Tantangan & Keseimbangan Batin', 'auto_match', 'Emotional Stability Mapping', 'Catat teknik regulasi emosi mana yang paling efektif selama fase ini', 'One-Time', 'Medium', '1 pemetaan teknik', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-21-inner-peace-maintenance-plan', 'PHASE_04', 'Emotional Mastery', 21, 'Evaluasi Paruh Tantangan & Keseimbangan Batin', 'auto_match', 'Inner Peace Maintenance Plan', 'Rumuskan 2 kebiasaan kecil harian untuk menjaga kesehatan emosi ke depan', 'One-Time', 'Medium', '2 kebiasaan kecil', 20, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 30, null, null),
  ('phase-04-day-21-phase-4-reflection-and-transition-essay', 'PHASE_04', 'Emotional Mastery', 21, 'Evaluasi Paruh Tantangan & Keseimbangan Batin', 'auto_match', 'Phase 4 Reflection & Transition Essay', 'Tulis esai refleksi mini minimal 150 kata tentang ketahanan mental & kesiapan ke Fase 5', 'One-Time', 'Hard', '150 kata esai', 30, 'SKILL_04', 'Resilience, Cognitive Flexibility, & Emotional Boundaries', 40, null, null),
  ('phase-05-day-22-morning-bold-intention', 'PHASE_05', 'Growth Expansion', 22, 'Memperluas Zona Nyaman (Comfort Zone Stretch)', 'auto_match', 'Morning Bold Intention', 'Tuliskan 1 hal di luar zona nyaman kecil yang akan dicoba hari ini', 'One-Time', 'Easy', '1 hal baru', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-22-posture-confidence-check', 'PHASE_05', 'Growth Expansion', 22, 'Memperluas Zona Nyaman (Comfort Zone Stretch)', 'auto_match', 'Posture & Confidence Check', 'Jaga postur tubuh tegak dan terbuka (power pose) di depan cermin selama 2 menit', 'One-Time', 'Easy', '2 menit', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-22-micro-risk-experiment', 'PHASE_05', 'Growth Expansion', 22, 'Memperluas Zona Nyaman (Comfort Zone Stretch)', 'auto_match', 'Micro-Risk Experiment', 'Lakukan 1 tindakan kecil yang biasanya dihindari karena ragu', 'One-Time', 'Medium', '1 tindakan kecil', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-22-assumption-challenging', 'PHASE_05', 'Growth Expansion', 22, 'Memperluas Zona Nyaman (Comfort Zone Stretch)', 'auto_match', 'Assumption Challenging', 'Tuliskan 1 keyakinan membatasi diri dan cari bukti nyata kesalahannya', 'One-Time', 'Medium', '1 keyakinan', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-22-the-discomfort-acceptance-pact', 'PHASE_05', 'Growth Expansion', 22, 'Memperluas Zona Nyaman (Comfort Zone Stretch)', 'auto_match', 'The Discomfort Acceptance Pact', 'Tulis esai mini minimal 150 kata tentang arti pertumbuhan & rasa tidak nyaman', 'One-Time', 'Hard', '150 kata', 30, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 40, null, null),
  ('phase-05-day-23-vision-board-quick-review', 'PHASE_05', 'Growth Expansion', 23, 'Visi & Kejelasan Tujuan Jangka Panjang', 'auto_match', 'Vision Board Quick Review', 'Lihat kembali daftar impian atau vision board selama 3 menit setelah bangun', 'One-Time', 'Easy', '3 menit', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-23-daily-alignment-check', 'PHASE_05', 'Growth Expansion', 23, 'Visi & Kejelasan Tujuan Jangka Panjang', 'auto_match', 'Daily Alignment Check', 'Tanyakan pada diri apakah tugas hari ini mendekatkan pada visi masa depan', 'One-Time', 'Easy', '1 pertanyaan refleksi', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-23-1-year-future-self-letter', 'PHASE_05', 'Growth Expansion', 23, 'Visi & Kejelasan Tujuan Jangka Panjang', 'auto_match', '1-Year Future Self Letter', 'Tulis draf surat singkat dari diri 1 tahun ke depan untuk usaha hari ini', 'One-Time', 'Medium', '1 surat singkat', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-23-goal-breakdown-to-quarterly-steps', 'PHASE_05', 'Growth Expansion', 23, 'Visi & Kejelasan Tujuan Jangka Panjang', 'auto_match', 'Goal Breakdown to Quarterly Steps', 'Pecah 1 tujuan besar tahun ini menjadi 3 target pencapaian kuartal', 'One-Time', 'Medium', '3 target kuartal', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-23-the-non-negotiable-standard-setup', 'PHASE_05', 'Growth Expansion', 23, 'Visi & Kejelasan Tujuan Jangka Panjang', 'auto_match', 'The Non-Negotiable Standard Setup', 'Tetapkan dan definisikan 3 standar perilaku mutlak baru yang tidak ditoleransi', 'One-Time', 'Hard', '3 standar perilaku', 30, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 40, null, null),
  ('phase-05-day-24-morning-decisiveness-pledge', 'PHASE_05', 'Growth Expansion', 24, 'Pengambilan Keputusan & Keberanian Memilih', 'auto_match', 'Morning Decisiveness Pledge', 'Komitmen tidak menunda keputusan kecil (pilih dalam waktu kurang dari 1 menit)', 'One-Time', 'Easy', '1 menit keputusan', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-24-gratitude-for-past-choices', 'PHASE_05', 'Growth Expansion', 24, 'Pengambilan Keputusan & Keberanian Memilih', 'auto_match', 'Gratitude for Past Choices', 'Syukuri 1 keputusan sulit di masa lalu yang membawa dampak positif kini', 'One-Time', 'Easy', '1 keputusan disyukuri', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-24-the-10-10-10-decision-framework', 'PHASE_05', 'Growth Expansion', 24, 'Pengambilan Keputusan & Keberanian Memilih', 'auto_match', 'The 10-10-10 Decision Framework', 'Analisis 1 pilihan hidup menggunakan kerangka waktu 10 menit, bulan, tahun', 'One-Time', 'Medium', '1 analisis kerangka', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-24-elimination-of-inaction', 'PHASE_05', 'Growth Expansion', 24, 'Pengambilan Keputusan & Keberanian Memilih', 'auto_match', 'Elimination of Inaction', 'Selesaikan 1 pilihan tertunda atau pending decision yang selama ini digantungkan', 'One-Time', 'Medium', '1 keputusan tuntas', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-24-bold-choice-commitment', 'PHASE_05', 'Growth Expansion', 24, 'Pengambilan Keputusan & Keberanian Memilih', 'auto_match', 'Bold Choice Commitment', 'Ambil 1 keputusan besar atau langkah nyata pengembangan diri yang ditunda', 'One-Time', 'Hard', '1 langkah nyata', 30, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 40, null, null),
  ('phase-05-day-25-micro-learning-session', 'PHASE_05', 'Growth Expansion', 25, 'Membangun Kepercayaan Diri Melalui Kompetensi', 'auto_match', 'Micro-Learning Session', 'Baca artikel edukatif, buku, atau podcast pengembangan diri selama 15 menit', 'One-Time', 'Easy', '15 menit belajar', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-25-skill-inventory-check', 'PHASE_05', 'Growth Expansion', 25, 'Membangun Kepercayaan Diri Melalui Kompetensi', 'auto_match', 'Skill Inventory Check', 'Catat 1 keahlian baru yang berhasil dipelajari atau dikuasai minggu ini', 'One-Time', 'Easy', '1 keahlian baru', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-25-practical-skill-application', 'PHASE_05', 'Growth Expansion', 25, 'Membangun Kepercayaan Diri Melalui Kompetensi', 'auto_match', 'Practical Skill Application', 'Terapkan langsung teori atau pengetahuan baru ke dalam proyek/pekerjaan', 'One-Time', 'Medium', '1 penerapan nyata', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-25-feedback-seeker', 'PHASE_05', 'Growth Expansion', 25, 'Membangun Kepercayaan Diri Melalui Kompetensi', 'auto_match', 'Feedback Seeker', 'Minta masukan atau kritik konstruktif dari orang lain terkait hasil kerja', 'One-Time', 'Medium', '1 masukan/feedback', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-25-the-45-minute-deep-mastery-block', 'PHASE_05', 'Growth Expansion', 25, 'Membangun Kepercayaan Diri Melalui Kompetensi', 'auto_match', 'The 45-Minute Deep Mastery Block', 'Pelajari materi/hard skill tersulit secara mendalam tanpa gangguan selama 45 menit', 'One-Time', 'Hard', '45 menit fokus', 30, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 40, null, null),
  ('phase-05-day-26-radical-accountability-check', 'PHASE_05', 'Growth Expansion', 26, 'Kepemimpinan Diri & Akuntabilitas', 'auto_match', 'Radical Accountability Check', 'Ucapkan kalimat pengakuan penanggung jawab utama hidup diri sendiri', 'One-Time', 'Easy', '1 kalimat ikrar', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-26-environment-audit-for-growth', 'PHASE_05', 'Growth Expansion', 26, 'Kepemimpinan Diri & Akuntabilitas', 'auto_match', 'Environment Audit for Growth', 'Dinilai apakah lingkungan pertemanan/informasi digital mendukung pertumbuhan', 'One-Time', 'Easy', '1 penilaian lingkungan', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-26-proactive-problem-solving', 'PHASE_05', 'Growth Expansion', 26, 'Kepemimpinan Diri & Akuntabilitas', 'auto_match', 'Proactive Problem Solving', 'Identifikasi 1 masalah kecil di sekitar dan langsung ambil inisiatif selesai', 'One-Time', 'Medium', '1 masalah selesai', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-26-time-investment-review', 'PHASE_05', 'Growth Expansion', 26, 'Kepemimpinan Diri & Akuntabilitas', 'auto_match', 'Time Investment Review', 'Evaluasi apakah alokasi waktu minggu ini sejalan dengan prioritas panjang', 'One-Time', 'Medium', '1 evaluasi waktu', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-26-personal-leadership-manifesto', 'PHASE_05', 'Growth Expansion', 26, 'Kepemimpinan Diri & Akuntabilitas', 'auto_match', 'Personal Leadership Manifesto', 'Tulis manifesto kepemimpinan diri (Self-Leadership Code) minimal 200 kata', 'One-Time', 'Hard', '200 kata manifesto', 30, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 40, null, null),
  ('phase-05-day-27-morning-resilient-mindset', 'PHASE_05', 'Growth Expansion', 27, 'Mengubah Kegagalan Menjadi Bahan Bakar', 'auto_match', 'Morning Resilient Mindset', 'Ingatkan diri bahwa kegagalan adalah bentuk data & latihan, bukan harga diri', 'One-Time', 'Easy', '1 pola pikir reset', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-27-physical-energy-boost', 'PHASE_05', 'Growth Expansion', 27, 'Mengubah Kegagalan Menjadi Bahan Bakar', 'auto_match', 'Physical Energy Boost', 'Lakukan peregangan dinamis atau olahraga ringan selama 15 menit', 'One-Time', 'Easy', '15 menit olahraga', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-27-past-setback-post-mortem', 'PHASE_05', 'Growth Expansion', 27, 'Mengubah Kegagalan Menjadi Bahan Bakar', 'auto_match', 'Past Setback Post-Mortem', 'Tuliskan 3 pelajaran berharga dari satu kegagalan terbesar masa lalu', 'One-Time', 'Medium', '3 pelajaran berharga', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-27-reframing-obstacles', 'PHASE_05', 'Growth Expansion', 27, 'Mengubah Kegagalan Menjadi Bahan Bakar', 'auto_match', 'Reframing Obstacles', 'Ubah 1 hambatan hari ini menjadi pertanyaan tantangan pemecahan masalah', 'One-Time', 'Medium', '1 pertanyaan tantangan', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-27-the-resilience-stress-test', 'PHASE_05', 'Growth Expansion', 27, 'Mengubah Kegagalan Menjadi Bahan Bakar', 'auto_match', 'The Resilience Stress-Test', 'Sengaja hadapi 1 tugas tersulit atau skenario terburuk hingga tuntas', 'One-Time', 'Hard', '1 uji tuntas', 30, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 40, null, null),
  ('phase-05-day-28-phase-5-progress-audit', 'PHASE_05', 'Growth Expansion', 28, 'Evaluasi Ekspansi & Persiapan Transformasi Akhir', 'auto_match', 'Phase 5 Progress Audit', 'Hitung tingkat penyelesaian misi dari Hari 22 hingga Hari 27', 'Weekly', 'Easy', '6 hari audit', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-28-mindful-relaxation-break', 'PHASE_05', 'Growth Expansion', 28, 'Evaluasi Ekspansi & Persiapan Transformasi Akhir', 'auto_match', 'Mindful Relaxation Break', 'Lakukan meditasi hening atau pernapasan rileks selama 10 menit di sore hari', 'One-Time', 'Easy', '10 menit meditasi', 10, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 20, null, null),
  ('phase-05-day-28-growth-capacity-mapping', 'PHASE_05', 'Growth Expansion', 28, 'Evaluasi Ekspansi & Persiapan Transformasi Akhir', 'auto_match', 'Growth Capacity Mapping', 'Catat pencapaian terbesar dalam keberanian dan peningkatan percaya diri', 'One-Time', 'Medium', '1 pemetaan kapasitas', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-28-system-bridge-setup', 'PHASE_05', 'Growth Expansion', 28, 'Evaluasi Ekspansi & Persiapan Transformasi Akhir', 'auto_match', 'System Bridge Setup', 'Siapkan kerangka sistem dan kebiasaan yang dibawa ke fase transisi akhir', 'One-Time', 'Medium', '1 kerangka sistem', 20, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 30, null, null),
  ('phase-05-day-28-phase-5-reflection-transition-essay', 'PHASE_05', 'Growth Expansion', 28, 'Evaluasi Ekspansi & Persiapan Transformasi Akhir', 'auto_match', 'Phase 5 Reflection & Transition Essay', 'Tulis esai refleksi mini minimal 150 kata tentang perluasan kapasitas & kesiapan ke Fase 6', 'One-Time', 'Hard', '150 kata esai', 30, 'SKILL_05', 'Growth Mindset, Risk Appetite, & Decision-Making', 40, null, null),
  ('phase-06-day-29-morning-gratitude-for-the-journey', 'PHASE_06', 'Final Transformation', 29, 'Refleksi Menyeluruh (The 40-Day Audit)', 'auto_match', 'Morning Gratitude for the Journey', 'Tuliskan 3 hal yang paling disyukuri karena telah bertahan hingga Hari ke-29', 'One-Time', 'Easy', '3 hal disyukuri', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-29-baseline-comparison-check', 'PHASE_06', 'Final Transformation', 29, 'Refleksi Menyeluruh (The 40-Day Audit)', 'auto_match', 'Baseline Comparison Check', 'Buka kembali catatan Hari 1 dan bandingkan kondisi diri saat itu dengan hari ini', 'One-Time', 'Easy', '1 perbandingan baseline', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-29-habit-tracker-comprehensive-review', 'PHASE_06', 'Final Transformation', 29, 'Refleksi Menyeluruh (The 40-Day Audit)', 'auto_match', 'Habit Tracker Comprehensive Review', 'Rekap persentase penyelesaian misi secara keseluruhan dari Fase 1 hingga Fase 5', 'One-Time', 'Medium', '1 rekap total', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-29-identifying-core-breakthroughs', 'PHASE_06', 'Final Transformation', 29, 'Refleksi Menyeluruh (The 40-Day Audit)', 'auto_match', 'Identifying Core Breakthroughs', 'Tuliskan 3 perubahan mental atau perilaku terbesar selama 4 minggu ke belakang', 'One-Time', 'Medium', '3 perubahan besar', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-29-the-40-day-transformation-journaling', 'PHASE_06', 'Final Transformation', 29, 'Refleksi Menyeluruh (The 40-Day Audit)', 'auto_match', 'The 40-Day Transformation Journaling', 'Tulis esai refleksi komprehensif minimal 200 kata tentang perjalanan transformasi', 'One-Time', 'Hard', '200 kata esai', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-30-mindful-centering-breath', 'PHASE_06', 'Final Transformation', 30, 'Evaluasi Hambatan & Titik Lemah', 'auto_match', 'Mindful Centering Breath', 'Lakukan pernapasan dalam selama 5 menit untuk menenangkan pikiran sebelum evaluasi', 'One-Time', 'Easy', '5 menit napas', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-30-recurrent-obstacle-log', 'PHASE_06', 'Final Transformation', 30, 'Evaluasi Hambatan & Titik Lemah', 'auto_match', 'Recurrent Obstacle Log', 'Catat 1 hambatan klasik atau kebiasaan lama yang paling sering kambuh', 'One-Time', 'Easy', '1 hambatan klasik', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-30-root-cause-re-analysis', 'PHASE_06', 'Final Transformation', 30, 'Evaluasi Hambatan & Titik Lemah', 'auto_match', 'Root Cause Re-Analysis', 'Analisis mengapa hambatan tersebut masih terjadi dan apa pemicu utamanya', 'One-Time', 'Medium', '1 analisis akar', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-30-counter-strategy-design', 'PHASE_06', 'Final Transformation', 30, 'Evaluasi Hambatan & Titik Lemah', 'auto_match', 'Counter-Strategy Design', 'Buat aturan atau sistem pengaman khusus untuk mencegah kebiasaan lama terulang', 'One-Time', 'Medium', '1 sistem pengaman', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-30-the-unforgiving-self-audit', 'PHASE_06', 'Final Transformation', 30, 'Evaluasi Hambatan & Titik Lemah', 'auto_match', 'The Unforgiving Self-Audit', 'Tulis surat teguran jujur kepada diri sendiri mengenai area perbaikan minimal 150 kata', 'One-Time', 'Hard', '150 kata surat', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-31-morning-identity-affirmation', 'PHASE_06', 'Final Transformation', 31, 'Mengunci Identitas Baru (Identity Locking)', 'auto_match', 'Morning Identity Affirmation', 'Ucapkan deklarasi identitas baru di depan cermin secara penuh kesadaran', 'One-Time', 'Easy', '1 deklarasi cermin', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-31-physical-workspace-final-polish', 'PHASE_06', 'Final Transformation', 31, 'Mengunci Identitas Baru (Identity Locking)', 'auto_match', 'Physical Workspace Final Polish', 'Rapikan dan bersihkan ruang kerja secara total sebagai simbol kejelasan mental', 'One-Time', 'Easy', '1 ruang kerja bersih', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-31-core-value-alignment-check', 'PHASE_06', 'Final Transformation', 31, 'Mengunci Identitas Baru (Identity Locking)', 'auto_match', 'Core Value Alignment Check', 'Selaraskan kembali 3 nilai hidup utama yang ditemukan di awal dengan masa depan', 'One-Time', 'Medium', '3 nilai hidup', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-31-boundary-enforcement-review', 'PHASE_06', 'Final Transformation', 31, 'Mengunci Identitas Baru (Identity Locking)', 'auto_match', 'Boundary Enforcement Review', 'Tuliskan daftar batasan diri (boundaries) yang tidak boleh dilanggar lagi', 'One-Time', 'Medium', '1 daftar batasan', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-31-the-new-identity-manifesto', 'PHASE_06', 'Final Transformation', 31, 'Mengunci Identitas Baru (Identity Locking)', 'auto_match', 'The New Identity Manifesto', 'Tulis manifesto identitas versi final minimal 200 kata tentang diri yang baru', 'One-Time', 'Hard', '200 kata manifesto', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-32-routine-simplification', 'PHASE_06', 'Final Transformation', 32, 'Desain Sistem Jangka Panjang', 'auto_match', 'Routine Simplification', 'Saring kebiasaan harian mana saja yang paling esensial untuk dipertahankan', 'One-Time', 'Easy', '1 daftar esensial', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-32-calendar-time-blocking-setup', 'PHASE_06', 'Final Transformation', 32, 'Desain Sistem Jangka Panjang', 'auto_match', 'Calendar Time-Blocking Setup', 'Susun kerangka jadwal harian ideal untuk rutinitas pasca-tantangan', 'One-Time', 'Easy', '1 kerangka jadwal', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-32-habit-stacking-architecture', 'PHASE_06', 'Final Transformation', 32, 'Desain Sistem Jangka Panjang', 'auto_match', 'Habit Stacking Architecture', 'Rancang rantai kebiasaan (habit stack) permanen untuk pagi dan malam hari', 'One-Time', 'Medium', '1 rantai habit', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-32-friction-reduction-audit', 'PHASE_06', 'Final Transformation', 32, 'Desain Sistem Jangka Panjang', 'auto_match', 'Friction Reduction Audit', 'Hilangkan hambatan fisik/digital agar kebiasaan baik mudah dieksekusi otomatis', 'One-Time', 'Medium', '1 audit gesekan', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-32-the-permanent-routine-blueprint', 'PHASE_06', 'Final Transformation', 32, 'Desain Sistem Jangka Panjang', 'auto_match', 'The Permanent Routine Blueprint', 'Tulis cetak biru (blueprint) jadwal mingguan komprehensif kerja & istirahat', 'One-Time', 'Hard', '1 cetak biru blueprint', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-33-morning-resilience-check', 'PHASE_06', 'Final Transformation', 33, 'Penguatan Mental & Resiliensi', 'auto_match', 'Morning Resilience Check', 'Tanamkan pola pikir bahwa tantangan di masa depan adalah latihan, bukan ancaman', 'One-Time', 'Easy', '1 pola pikir latihan', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-33-mindful-body-relaxation', 'PHASE_06', 'Final Transformation', 33, 'Penguatan Mental & Resiliensi', 'auto_match', 'Mindful Body Relaxation', 'Lakukan peregangan dan relaksasi otot penuh selama 10 menit', 'One-Time', 'Easy', '10 menit relaksasi', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-33-worst-case-scenario-planning', 'PHASE_06', 'Final Transformation', 33, 'Penguatan Mental & Resiliensi', 'auto_match', 'Worst-Case Scenario Planning', 'Tuliskan skenario terburuk masa depan dan rumuskan langkah antisipasinya', 'One-Time', 'Medium', '1 skenario terburuk', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-33-emotional-anchor-identification', 'PHASE_06', 'Final Transformation', 33, 'Penguatan Mental & Resiliensi', 'auto_match', 'Emotional Anchor Identification', 'Tentukan 2 teknik regulasi emosi paling ampuh untuk diandalkan saat stres', 'One-Time', 'Medium', '2 teknik regulasi', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-33-the-relapse-prevention-protocol', 'PHASE_06', 'Final Transformation', 33, 'Penguatan Mental & Resiliensi', 'auto_match', 'The Relapse Prevention Protocol', 'Susun dokumen protokol tertulis langkah darurat saat burnout minimal 150 kata', 'One-Time', 'Hard', '150 kata protokol', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-34-morning-vision-board-review', 'PHASE_06', 'Final Transformation', 34, 'Merancang Visi 1 Tahun ke Depan', 'auto_match', 'Morning Vision Board Review', 'Visualisasikan pencapaian 1 tahun ke depan selama 5 menit di pagi hari', 'One-Time', 'Easy', '5 menit visualisasi', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-34-core-milestone-setting', 'PHASE_06', 'Final Transformation', 34, 'Merancang Visi 1 Tahun ke Depan', 'auto_match', 'Core Milestone Setting', 'Tuliskan 3 target besar utama yang ingin dicapai dalam 12 bulan ke depan', 'One-Time', 'Easy', '3 target utama', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-34-quarterly-objective-breakdown', 'PHASE_06', 'Final Transformation', 34, 'Merancang Visi 1 Tahun ke Depan', 'auto_match', 'Quarterly Objective Breakdown', 'Pecah target 1 tahun menjadi target-target kuartalan yang terukur', 'One-Time', 'Medium', '4 target kuartal', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-34-skill-resource-gap-analysis', 'PHASE_06', 'Final Transformation', 34, 'Merancang Visi 1 Tahun ke Depan', 'auto_match', 'Skill & Resource Gap Analysis', 'Identifikasi keterampilan atau sumber daya yang harus dipelajari untuk target', 'One-Time', 'Medium', '1 analisis gap skill', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-34-the-1-year-master-plan-essay', 'PHASE_06', 'Final Transformation', 34, 'Merancang Visi 1 Tahun ke Depan', 'auto_match', 'The 1-Year Master Plan Essay', 'Tulis esai naratif penuh gambaran sukses hidup 1 tahun ke depan minimal 200 kata', 'One-Time', 'Hard', '200 kata esai master', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-35-self-leadership-pledge', 'PHASE_06', 'Final Transformation', 35, 'Akuntabilitas & Komitmen', 'auto_match', 'Self-Leadership Pledge', 'Baca ulang ikrar komitmen pribadi untuk hidup dengan penuh kesadaran & integritas', 'One-Time', 'Easy', '1 ikrar komitmen', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-35-digital-environment-optimization', 'PHASE_06', 'Final Transformation', 35, 'Akuntabilitas & Komitmen', 'auto_match', 'Digital Environment Optimization', 'Bersihkan dan rapikan seluruh file atau aplikasi digital pendukung produktivitas', 'One-Time', 'Easy', '1 optimasi digital', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-35-accountability-system-setup', 'PHASE_06', 'Final Transformation', 35, 'Akuntabilitas & Komitmen', 'auto_match', 'Accountability System Setup', 'Tentukan cara evaluasi diri setiap minggunya (misal: Weekly Review)', 'One-Time', 'Medium', '1 sistem evaluasi', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-35-non-negotiable-rules-definition', 'PHASE_06', 'Final Transformation', 35, 'Akuntabilitas & Komitmen', 'auto_match', 'Non-Negotiable Rules Definition', 'Tuliskan 5 aturan mutlak harian yang tidak boleh dilanggar dalam kondisi apapun', 'One-Time', 'Medium', '5 aturan mutlak', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-35-the-personal-governance-code', 'PHASE_06', 'Final Transformation', 35, 'Akuntabilitas & Komitmen', 'auto_match', 'The Personal Governance Code', 'Susun piagam hukum pribadi berisi nilai, hak, dan kewajiban minimal 200 kata', 'One-Time', 'Hard', '200 kata piagam', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-36-morning-surrender-intention', 'PHASE_06', 'Final Transformation', 36, 'Seni Melepaskan Ekspektasi', 'auto_match', 'Morning Surrender Intention', 'Ingatkan diri bahwa Anda hanya bisa mengontrol usaha, bukan hasil akhir', 'One-Time', 'Easy', '1 niat pasrah usaha', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-36-mindful-tea-coffee-ritual', 'PHASE_06', 'Final Transformation', 36, 'Seni Melepaskan Ekspektasi', 'auto_match', 'Mindful Tea/Coffee Ritual', 'Nikmati minuman pagi dalam keheningan total tanpa gangguan gawai', 'One-Time', 'Easy', '1 cangkir hening', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-36-control-audit', 'PHASE_06', 'Final Transformation', 36, 'Seni Melepaskan Ekspektasi', 'auto_match', 'Control Audit', 'Pilah masalah hidup ke dalam dua kategori: bisa dikontrol vs di luar kendali', 'One-Time', 'Medium', '1 audit kendali', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-36-letting-go-of-perfectionism', 'PHASE_06', 'Final Transformation', 36, 'Seni Melepaskan Ekspektasi', 'auto_match', 'Letting Go of Perfectionism', 'Selesaikan 1 tugas dengan standar "selesai dan bagus" tanpa menunggu sempurna', 'One-Time', 'Medium', '1 tugas selesai bagus', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-36-the-inner-peace-reflection', 'PHASE_06', 'Final Transformation', 36, 'Seni Melepaskan Ekspektasi', 'auto_match', 'The Inner Peace Reflection', 'Tulis esai mini tentang keikhlasan dan pelepasan ekspektasi kaku minimal 150 kata', 'One-Time', 'Hard', '150 kata esai damai', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-37-self-appreciation-note', 'PHASE_06', 'Final Transformation', 37, 'Persiapan Perayaan & Apresiasi Diri', 'auto_match', 'Self-Appreciation Note', 'Tuliskan pesan terima kasih yang tulus untuk diri sendiri di buku catatan', 'One-Time', 'Easy', '1 catatan apresiasi', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-37-milestone-reward-planning', 'PHASE_06', 'Final Transformation', 37, 'Persiapan Perayaan & Apresiasi Diri', 'auto_match', 'Milestone Reward Planning', 'Rencanakan bentuk penghargaan positif untuk diberikan pada Hari ke-40', 'One-Time', 'Easy', '1 rencana reward', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-37-journey-scrapbook-compilation', 'PHASE_06', 'Final Transformation', 37, 'Persiapan Perayaan & Apresiasi Diri', 'auto_match', 'Journey Scrapbook Compilation', 'Kumpulkan catatan, esai, dan kutipan terbaik dari Hari 1 hingga Hari 36', 'One-Time', 'Medium', '1 kompilasi scrapbook', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-37-gratitude-outreach', 'PHASE_06', 'Final Transformation', 37, 'Persiapan Perayaan & Apresiasi Diri', 'auto_match', 'Gratitude Outreach', 'Ucapkan terima kasih kepada pihak yang mendukung proses Anda', 'One-Time', 'Medium', '1 pesan terima kasih', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-37-the-gratitude-essay', 'PHASE_06', 'Final Transformation', 37, 'Persiapan Perayaan & Apresiasi Diri', 'auto_match', 'The Gratitude Essay', 'Tulis esai penuh rasa syukur atas segala hambatan dan pertumbuhan minimal 200 kata', 'One-Time', 'Hard', '200 kata esai syukur', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-38-morning-alignment-stretch', 'PHASE_06', 'Final Transformation', 38, 'Integrasi Tubuh, Pikiran, dan Jiwa', 'auto_match', 'Morning Alignment Stretch', 'Lakukan peregangan fisik menyeluruh dan pernapasan dalam di pagi hari', 'One-Time', 'Easy', '1 sesi peregangan', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-38-digital-detox-evening', 'PHASE_06', 'Final Transformation', 38, 'Integrasi Tubuh, Pikiran, dan Jiwa', 'auto_match', 'Digital Detox Evening', 'Matikan semua layar gadget 1 jam lebih awal sebelum waktu tidur malam', 'One-Time', 'Easy', '1 jam sebelum tidur', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-38-mind-body-balance-check', 'PHASE_06', 'Final Transformation', 38, 'Integrasi Tubuh, Pikiran, dan Jiwa', 'auto_match', 'Mind-Body Balance Check', 'Evaluasi keseimbangan antara kesehatan fisik, ketajaman mental, dan emosi', 'One-Time', 'Medium', '1 evaluasi balance', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-38-habit-automation-review', 'PHASE_06', 'Final Transformation', 38, 'Integrasi Tubuh, Pikiran, dan Jiwa', 'auto_match', 'Habit Automation Review', 'Pastikan kebiasaan baik mana yang sudah berjalan otomatis tanpa usaha besar', 'One-Time', 'Medium', '1 review otomatisasi', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-38-the-holistics-integration-blueprint', 'PHASE_06', 'Final Transformation', 38, 'Integrasi Tubuh, Pikiran, dan Jiwa', 'auto_match', 'The Holistics Integration Blueprint', 'Tulis dokumen integrasi akhir perpaduan fisik, pikiran, dan emosi minimal 150 kata', 'One-Time', 'Hard', '150 kata blueprint', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-39-early-morning-routine-execution', 'PHASE_06', 'Final Transformation', 39, 'Gladi Bersih Kehidupan Baru', 'auto_match', 'Early Morning Routine Execution', 'Jalankan rutinitas pagi baru secara disiplin tanpa snooze dan tanpa distraksi', 'One-Time', 'Easy', '1 eksekusi pagi disiplin', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-39-deep-work-simulation', 'PHASE_06', 'Final Transformation', 39, 'Gladi Bersih Kehidupan Baru', 'auto_match', 'Deep Work Simulation', 'Selesaikan sesi fokus mendalam selama 60 menit dengan standar tertinggi', 'One-Time', 'Easy', '60 menit simulasi', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-39-mindful-response-practice', 'PHASE_06', 'Final Transformation', 39, 'Gladi Bersih Kehidupan Baru', 'auto_match', 'Mindful Response Practice', 'Sengaja terapkan jeda 10 detik & cognitive reframing saat situasi menantang', 'One-Time', 'Medium', '1 latihan respons', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-39-evening-review-fine-tuning', 'PHASE_06', 'Final Transformation', 39, 'Gladi Bersih Kehidupan Baru', 'auto_match', 'Evening Review & Fine-Tuning', 'Lakukan evaluasi penutup hari untuk fine-tuning simulasi hidup baru', 'One-Time', 'Medium', '1 review penutup', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-39-the-final-simulation-essay', 'PHASE_06', 'Final Transformation', 39, 'Gladi Bersih Kehidupan Baru', 'auto_match', 'The Final Simulation Essay', 'Tulis refleksi mendalam mengenai rasanya menjalani hari sebagai versi terbaik minimal 150 kata', 'One-Time', 'Hard', '150 kata esai simulasi', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null),
  ('phase-06-day-40-dawn-gratitude-reflection', 'PHASE_06', 'Final Transformation', 40, 'Puncak Transformasi', 'auto_match', 'Dawn Gratitude & Reflection', 'Sambut fajar Hari ke-40 dengan rasa syukur mendalam dan kesadaran penuh', 'One-Time', 'Easy', '1 sambutan fajar', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-40-the-40-day-completion-mark', 'PHASE_06', 'Final Transformation', 40, 'Puncak Transformasi', 'auto_match', 'The 40-Day Completion Mark', 'Secara resmi tandai status "Selesai 100%" pada pelacak tantangan 40 hari Anda', 'One-Time', 'Easy', '1 tanda 100% selesai', 10, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 20, null, null),
  ('phase-06-day-40-milestone-celebration-execution', 'PHASE_06', 'Final Transformation', 40, 'Puncak Transformasi', 'auto_match', 'Milestone Celebration Execution', 'Nikmati hadiah atau perayaan kecil yang telah direncanakan sebagai apresiasi', 'One-Time', 'Medium', '1 eksekusi reward', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-40-the-future-self-commitment-pact', 'PHASE_06', 'Final Transformation', 40, 'Puncak Transformasi', 'auto_match', 'The Future Self Commitment Pact', 'Tandatangani komitmen akhir seumur hidup menjaga pertumbuhan dan integritas', 'One-Time', 'Medium', '1 pakta komitmen akhir', 20, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 30, null, null),
  ('phase-06-day-40-the-final-rebirth-manifesto', 'PHASE_06', 'Final Transformation', 40, 'Puncak Transformasi', 'auto_match', 'The Final Rebirth Manifesto', 'Tulis esai penutup agung bertajuk "Kelahiranku yang Baru" minimal 300 kata', 'One-Time', 'Hard', '300 kata esai rebirth', 30, 'SKILL_06', 'Strategic Planning, Sustainability, & Self-Governance', 40, null, null)
on conflict (id) do update
  set phase_category_id = excluded.phase_category_id,
      phase_name = excluded.phase_name,
      day_number = excluded.day_number,
      focus = excluded.focus,
      cover_image = excluded.cover_image,
      task_name = excluded.task_name,
      short_description = excluded.short_description,
      frequency = excluded.frequency,
      level = excluded.level,
      target = excluded.target,
      total_coin = excluded.total_coin,
      skill_category_id = excluded.skill_category_id,
      soft_skills = excluded.soft_skills,
      max_possible_coin = excluded.max_possible_coin,
      coin_user = excluded.coin_user,
      percentage_rule = excluded.percentage_rule;

create table if not exists public.user_phase_quest_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  quest_id text not null references public.phase_daily_quests (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);

alter table public.user_phase_quest_progress
  add column if not exists achieved_amount numeric not null default 0 check (achieved_amount >= 0),
  add column if not exists earned_coin integer not null default 0 check (earned_coin >= 0),
  add column if not exists progress_updated boolean not null default false;

alter table public.user_phase_quest_progress
  alter column completed_at drop not null,
  alter column completed_at drop default;

update public.user_phase_quest_progress as progress
  set achieved_amount = case
        when quest.target ~* '^\s*skala' then replace(
          substring(quest.target from '([0-9]+([.,][0-9]+)?)[^0-9]*$'),
          ',',
          '.'
        )::numeric
        else replace(
          substring(quest.target from '^\s*([0-9]+([.,][0-9]+)?)'),
          ',',
          '.'
        )::numeric
      end,
      earned_coin = quest.total_coin,
      progress_updated = false
  from public.phase_daily_quests as quest
  where quest.id = progress.quest_id
    and progress.completed_at is not null
    and progress.earned_coin = 0;

alter table public.user_phase_quest_progress enable row level security;
revoke all on table public.user_phase_quest_progress from public, anon, authenticated;
grant select on table public.user_phase_quest_progress to authenticated;

drop policy if exists "Users can read their own phase quest progress" on public.user_phase_quest_progress;
create policy "Users can read their own phase quest progress"
  on public.user_phase_quest_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can complete their own phase quests" on public.user_phase_quest_progress;
drop policy if exists "Users can undo their own phase quests" on public.user_phase_quest_progress;

create or replace function public.save_phase_quest_progress(
  p_quest_id text,
  p_achieved_amount numeric default null,
  p_is_completed boolean default false
)
returns table (
  quest_id text,
  achieved_amount numeric,
  earned_coin integer,
  progress_updated boolean,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  quest_target text;
  quest_base_coin integer;
  target_amount numeric;
  next_amount numeric;
  next_progress_updated boolean;
  next_earned_coin integer;
  existing_progress public.user_phase_quest_progress%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to update quest progress';
  end if;

  select q.target, q.total_coin
    into quest_target, quest_base_coin
    from public.phase_daily_quests as q
    where q.id = p_quest_id;

  if not found then
    raise exception 'Daily quest does not exist';
  end if;

  if quest_target ~* '^\s*skala' then
    target_amount := replace(
      substring(quest_target from '([0-9]+([.,][0-9]+)?)[^0-9]*$'),
      ',',
      '.'
    )::numeric;
  else
    target_amount := replace(
      substring(quest_target from '^\s*([0-9]+([.,][0-9]+)?)'),
      ',',
      '.'
    )::numeric;
  end if;

  if target_amount is null then
    raise exception 'Daily quest target must begin with a numeric amount';
  end if;

  select p.*
    into existing_progress
    from public.user_phase_quest_progress as p
    where p.user_id = current_user_id
      and p.quest_id = p_quest_id
    for update;

  if p_achieved_amount is not null then
    if p_achieved_amount < 0 then
      raise exception 'Progress amount cannot be negative';
    end if;
    next_amount := p_achieved_amount;
    next_progress_updated := true;
  elsif found then
    next_amount := existing_progress.achieved_amount;
    next_progress_updated := existing_progress.progress_updated;
  else
    next_amount := case when coalesce(p_is_completed, false) then target_amount else 0 end;
    next_progress_updated := false;
  end if;

  next_earned_coin := case
    when coalesce(p_is_completed, false) then
      quest_base_coin + case when next_amount >= target_amount then 10 else 0 end
    else 0
  end;

  return query
    insert into public.user_phase_quest_progress as saved_progress (
      user_id,
      quest_id,
      achieved_amount,
      earned_coin,
      progress_updated,
      completed_at
    )
    values (
      current_user_id,
      p_quest_id,
      next_amount,
      next_earned_coin,
      next_progress_updated,
      case when coalesce(p_is_completed, false) then now() else null end
    )
    on conflict on constraint user_phase_quest_progress_pkey do update
      set achieved_amount = excluded.achieved_amount,
          earned_coin = excluded.earned_coin,
          progress_updated = excluded.progress_updated,
          completed_at = excluded.completed_at
    returning saved_progress.quest_id,
      saved_progress.achieved_amount,
      saved_progress.earned_coin,
      saved_progress.progress_updated,
      saved_progress.completed_at;
end;
$$;

revoke execute on function public.save_phase_quest_progress(text, numeric, boolean) from public, anon;
grant execute on function public.save_phase_quest_progress(text, numeric, boolean) to authenticated;
notify pgrst, 'reload schema';

create table if not exists public.user_daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_name text not null check (char_length(task_name) between 1 and 60),
  short_description text not null,
  start_date smallint not null check (start_date between 1 and 40),
  end_date smallint not null check (end_date between 1 and 40),
  frequency text not null check (frequency in ('One-Time', 'Daily', 'Weekly')),
  level text not null check (level in ('Easy', 'Medium', 'Hard')),
  total_coin integer not null default 10 check (total_coin in (10, 20, 30)),
  day_number smallint not null check (day_number between 1 and 40),
  start_day smallint not null default 1 check (start_day between 1 and 40),
  end_day smallint not null default 1 check (end_day between 1 and 40),
  title text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  schedule text not null check (schedule in ('one-time', 'daily', 'weekly')),
  target_amount numeric check (target_amount is null or target_amount > 0),
  target_unit text,
  achieved_amount numeric not null default 0 check (achieved_amount >= 0),
  is_completed boolean not null default false,
  earned_coin integer not null default 0 check (earned_coin >= 0),
  created_at timestamptz not null default now(),
  check (end_day >= start_day),
  check ((target_amount is null and target_unit is null) or (target_amount is not null and target_unit is not null and char_length(target_unit) between 1 and 24))
);

alter table public.user_daily_quests
  add column if not exists start_day smallint not null default 1,
  add column if not exists end_day smallint not null default 1,
  add column if not exists short_description text not null default '',
  add column if not exists total_coin integer not null default 10,
  add column if not exists task_name text not null default '',
  add column if not exists start_date smallint not null default 1,
  add column if not exists end_date smallint not null default 1,
  add column if not exists frequency text not null default 'One-Time';

alter table public.user_daily_quests
  drop constraint if exists user_daily_quests_schedule_check;

update public.user_daily_quests
  set start_day = day_number,
      end_day = day_number,
      short_description = description,
      schedule = case when schedule in ('2x', '3x') then 'weekly' else schedule end,
      total_coin = case level when 'Easy' then 10 when 'Medium' then 20 when 'Hard' then 30 else 10 end,
      task_name = title,
      start_date = day_number,
      end_date = day_number,
      frequency = case schedule when 'daily' then 'Daily' when 'weekly' then 'Weekly' when '2x' then 'Weekly' when '3x' then 'Weekly' else 'One-Time' end
  where start_day = 1
    and end_day = 1
    and (day_number <> 1 or short_description = '' or task_name = '' or schedule in ('2x', '3x'));

update public.user_daily_quests
  set task_name = title,
      start_date = start_day,
      end_date = end_day,
      frequency = case schedule when 'daily' then 'Daily' when 'weekly' then 'Weekly' when '2x' then 'Weekly' when '3x' then 'Weekly' else 'One-Time' end
  where task_name = ''
     or start_date = 1 and start_day <> 1
     or end_date = 1 and end_day <> 1;

alter table public.user_daily_quests
  add constraint user_daily_quests_schedule_check check (schedule in ('one-time', 'daily', 'weekly')),
  drop constraint if exists user_daily_quests_frequency_check,
  add constraint user_daily_quests_frequency_check check (frequency in ('One-Time', 'Daily', 'Weekly')),
  drop constraint if exists user_daily_quests_start_date_check,
  add constraint user_daily_quests_start_date_check check (start_date between 1 and 40),
  drop constraint if exists user_daily_quests_end_date_check,
  add constraint user_daily_quests_end_date_check check (end_date between 1 and 40),
  drop constraint if exists user_daily_quests_task_name_check,
  add constraint user_daily_quests_task_name_check check (char_length(task_name) between 1 and 60),
  drop constraint if exists user_daily_quests_short_description_check,
  add constraint user_daily_quests_short_description_check check (char_length(short_description) <= 300),
  drop constraint if exists user_daily_quests_start_day_check,
  add constraint user_daily_quests_start_day_check check (start_day between 1 and 40),
  drop constraint if exists user_daily_quests_end_day_check,
  add constraint user_daily_quests_end_day_check check (end_day between 1 and 40),
  drop constraint if exists user_daily_quests_total_coin_check,
  add constraint user_daily_quests_total_coin_check check (total_coin in (10, 20, 30)),
  drop constraint if exists user_daily_quests_check,
  drop constraint if exists user_daily_quests_day_range_check,
  add constraint user_daily_quests_day_range_check check (end_day >= start_day);

alter table public.user_daily_quests
  drop constraint if exists user_daily_quests_date_range_check,
  add constraint user_daily_quests_date_range_check check (end_date >= start_date);

create or replace function public.enforce_user_daily_quest_reward()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := new.task_name;
  new.day_number := new.start_date;
  new.start_day := new.start_date;
  new.end_day := new.end_date;
  new.description := new.short_description;
  new.schedule := case new.frequency
    when 'Daily' then 'daily'
    when 'Weekly' then 'weekly'
    else 'one-time'
  end;
  new.total_coin := case new.level
    when 'Easy' then 10
    when 'Medium' then 20
    when 'Hard' then 30
  end;
  new.earned_coin := case
    when new.is_completed then
      new.total_coin + case
        when new.target_amount is not null and new.achieved_amount >= new.target_amount then 10
        else 0
      end
    else 0
  end;
  return new;
end;
$$;

drop trigger if exists enforce_user_daily_quest_reward on public.user_daily_quests;
create trigger enforce_user_daily_quest_reward
  before insert or update on public.user_daily_quests
  for each row execute procedure public.enforce_user_daily_quest_reward();

alter table public.user_daily_quests enable row level security;
revoke all on table public.user_daily_quests from public, anon, authenticated;
grant select, insert, update, delete on table public.user_daily_quests to authenticated;

drop policy if exists "Users can read their own daily quests" on public.user_daily_quests;
create policy "Users can read their own daily quests"
  on public.user_daily_quests
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own daily quests" on public.user_daily_quests;
create policy "Users can create their own daily quests"
  on public.user_daily_quests
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own daily quests" on public.user_daily_quests;
create policy "Users can update their own daily quests"
  on public.user_daily_quests
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own daily quests" on public.user_daily_quests;
create policy "Users can delete their own daily quests"
  on public.user_daily_quests
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
notify pgrst, 'reload schema';

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;

  insert into public.challenge_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.bonus_resources (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('ebook', 'tracker')),
  title text not null check (char_length(title) between 1 and 100),
  description text not null check (char_length(description) between 1 and 300),
  image_url text not null,
  download_url text not null check (download_url ~* '^https://(drive|docs)\.google\.com/'),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.bonus_resources enable row level security;
revoke all on table public.bonus_resources from public, anon, authenticated;
grant select, insert, delete on table public.bonus_resources to authenticated;

drop policy if exists "Authenticated users can read bonus resources" on public.bonus_resources;
create policy "Authenticated users can read bonus resources"
  on public.bonus_resources
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can create bonus resources" on public.bonus_resources;
create policy "Admins can create bonus resources"
  on public.bonus_resources
  for insert
  to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));

drop policy if exists "Admins can delete bonus resources" on public.bonus_resources;
create policy "Admins can delete bonus resources"
  on public.bonus_resources
  for delete
  to authenticated
  using ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bonus-covers',
  'bonus-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view bonus covers" on storage.objects;
create policy "Anyone can view bonus covers"
  on storage.objects
  for select
  to public
  using (bucket_id = 'bonus-covers');

drop policy if exists "Admins can upload bonus covers" on storage.objects;
create policy "Admins can upload bonus covers"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bonus-covers'
    and (select public.is_admin())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Admins can delete bonus covers" on storage.objects;
create policy "Admins can delete bonus covers"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'bonus-covers' and (select public.is_admin()));

-- Promote an existing profile manually in the SQL Editor:
-- update public.profiles set role = 'admin' where email = 'admin@example.com';
