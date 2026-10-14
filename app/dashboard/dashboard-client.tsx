"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PDFDocument, PDFName, PDFRawStream, StandardFonts, decodePDFRawStream, rgb } from "pdf-lib";
import { strToU8, zipSync } from "fflate";
import { createClient } from "@/lib/supabase/client";
import type { BonusType, UploadedBonusResource } from "@/lib/bonus";
import type { PhaseDailyQuest, PhaseQuestProgress } from "@/lib/phase-quests";
import type { UserDailyQuest } from "@/lib/user-daily-quests";

type Gender = "woman" | "man";
type Language = "en" | "id";
type LeaderboardPeriod = "daily" | "weekly" | "phase";
type CoinLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gender: Gender | null;
  totalCoin: number;
  rank: number;
};
function parseCoinLeaderboard(value: unknown): CoinLeaderboardEntry[] {
  if (!Array.isArray(value) || value.length > 101) {
    throw new Error("Supabase returned an invalid leaderboard response");
  }
  let previousRank = 0;
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error("Supabase returned an invalid leaderboard entry");
    const totalCoin = typeof item.total_coin === "number" ? item.total_coin : Number(item.total_coin);
    const rank = typeof item.leaderboard_rank === "number" ? item.leaderboard_rank : Number(item.leaderboard_rank);
    if (
      typeof item.user_id !== "string"
      || typeof item.display_name !== "string"
      || (item.avatar_url !== null && typeof item.avatar_url !== "string")
      || (item.gender !== null && item.gender !== "woman" && item.gender !== "man")
      || !Number.isSafeInteger(totalCoin)
      || totalCoin < 0
      || !Number.isSafeInteger(rank)
      || rank <= previousRank
      || (index < 100 && rank !== index + 1)
    ) {
      throw new Error("Supabase returned an invalid leaderboard entry");
    }
    previousRank = rank;
    return {
      userId: item.user_id,
      displayName: item.display_name,
      avatarUrl: item.avatar_url,
      gender: item.gender,
      totalCoin,
      rank,
    };
  });
}
type BonusResource = { title: string; category: string; description: string; detail: string; image: string; rows?: string[][] };
type ProfileDialog = "edit" | "reset" | "certificate" | "feedback" | "logout" | null;
type CompletionDialog = "certificate" | null;
type ProfileTheme = "dark" | "light";
type SoftSkillAssessment = {
  skillCategoryId: string;
  softSkills: string;
  earnedCoin: number;
  maxPossibleCoin: number;
};
const certificateSkillOrder = [
  {
    skillCategoryId: "SKILL_01",
    softSkills: "Self-Awareness, Emotional Regulation, & Personal Accountability",
    labelBaseline: 370.48,
    labelValue: "Self-Awareness, Emotional Regulation, & Personal",
    continuationBaseline: 355.85,
    continuationLabel: "Accountability",
    earnedScoreBaseline: 370.09,
    earnedScoreFieldX: 501.82,
    maximumScoreBaseline: 370.48,
    percentageBaseline: 370.48,
    scoreCenter: 508.4,
  },
  {
    skillCategoryId: "SKILL_02",
    softSkills: "System Thinking, Discipline, & Operational Efficiency",
    labelBaseline: 330.73,
    earnedScoreBaseline: 330.34,
    earnedScoreFieldX: 501.82,
    maximumScoreBaseline: 330.73,
    percentageBaseline: 330.73,
    scoreCenter: 508.4,
  },
  {
    skillCategoryId: "SKILL_03",
    softSkills: "Focus Mastery, Task Initiation, & Time Management",
    labelBaseline: 290.98,
    earnedScoreBaseline: 290.59,
    earnedScoreFieldX: 501.82,
    maximumScoreBaseline: 290.98,
    percentageBaseline: 290.98,
    scoreCenter: 508.4,
  },
  {
    skillCategoryId: "SKILL_05",
    softSkills: "Growth Mindset, Risk Appetite, & Decision-Making",
    labelBaseline: 251.23,
    earnedScoreBaseline: 250.84,
    earnedScoreFieldX: 500.64,
    maximumScoreBaseline: 251.23,
    percentageBaseline: 251.23,
    scoreCenter: 507.22,
  },
  {
    skillCategoryId: "SKILL_04",
    softSkills: "Resilience, Cognitive Flexibility, & Emotional Boundaries",
    labelBaseline: 211.48,
    earnedScoreBaseline: 211.09,
    earnedScoreFieldX: 496.61,
    maximumScoreBaseline: 211.48,
    percentageBaseline: 211.48,
    scoreCenter: 506.49,
  },
  {
    skillCategoryId: "SKILL_06",
    softSkills: "Strategic Planning, Sustainability, & Self-Governance",
    labelBaseline: 171.73,
    earnedScoreBaseline: 171.34,
    earnedScoreFieldX: 501.33,
    maximumScoreBaseline: 171.73,
    percentageBaseline: 171.73,
    scoreCenter: 507.91,
  },
] as const;
type CertificateAssessmentRow = (typeof certificateSkillOrder)[number] & {
  assessment: SoftSkillAssessment;
};
type ClaimedCertificate = {
  verificationCode: string;
  issuedAt: string;
  fullName: string;
  assessmentRows: CertificateAssessmentRow[];
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCertificateAssessmentRows(value: unknown): CertificateAssessmentRow[] {
  if (!Array.isArray(value) || value.length !== certificateSkillOrder.length) {
    throw new Error("Supabase returned an invalid saved certificate assessment");
  }
  const savedAssessments = new Map<string, SoftSkillAssessment>();
  for (const item of value) {
    if (
      !isRecord(item)
      || typeof item.skillCategoryId !== "string"
      || typeof item.softSkills !== "string"
      || typeof item.earnedCoin !== "number"
      || !Number.isFinite(item.earnedCoin)
      || typeof item.maxPossibleCoin !== "number"
      || !Number.isFinite(item.maxPossibleCoin)
    ) {
      throw new Error("Supabase returned an invalid saved certificate assessment");
    }
    const { skillCategoryId, softSkills, earnedCoin, maxPossibleCoin } = item;
    const configuredSkill = certificateSkillOrder.find((skill) => skill.skillCategoryId === skillCategoryId);
    if (
      !configuredSkill
      || configuredSkill.softSkills !== softSkills
      || earnedCoin < 0
      || maxPossibleCoin < 0
      || savedAssessments.has(skillCategoryId)
    ) {
      throw new Error("Supabase returned an inconsistent saved certificate assessment");
    }
    savedAssessments.set(skillCategoryId, { skillCategoryId, softSkills, earnedCoin, maxPossibleCoin });
  }
  return certificateSkillOrder.map((skill) => {
    const assessment = savedAssessments.get(skill.skillCategoryId);
    if (!assessment) throw new Error(`Saved certificate assessment is missing ${skill.skillCategoryId}`);
    return { ...skill, assessment };
  });
}

function parseClaimedCertificate(value: unknown): ClaimedCertificate {
  if (
    !isRecord(value)
    || typeof value.verification_code !== "string"
    || !/^JOOLO\/40DC\/[IVX]+\/\d{4}\/\d{5,}$/.test(value.verification_code)
    || typeof value.issued_at !== "string"
    || !Number.isFinite(Date.parse(value.issued_at))
    || typeof value.certificate_name !== "string"
    || !value.certificate_name.trim()
  ) {
    throw new Error("Supabase returned an invalid saved certificate record");
  }
  return {
    verificationCode: value.verification_code,
    issuedAt: value.issued_at,
    fullName: value.certificate_name,
    assessmentRows: parseCertificateAssessmentRows(value.assessment_snapshot),
  };
}

type ProcessedChallengeLives = {
  lives: number;
  life_reset: boolean;
  start_date: string;
  last_evaluated_day: number;
  lives_purchased: number;
  coin_balance: number;
};

const indonesianTranslations: Record<string, string> = {
  "Main navigation": "Navigasi utama",
  "Leaderboard": "Papan peringkat",
  "Challenge": "Tantangan",
  "Bonus": "Bonus",
  "Language": "Bahasa",
  "Profile": "Profil",
  "Back to journey": "Kembali ke perjalanan",
  "Today": "Hari ini",
  "XP": "XP",
  "coin": "koin",
  "pages": "halaman",
  "minutes": "menit",
  "reps": "repetisi",
  "glasses": "gelas",
  "times": "kali",
  "e.g. Run 5 km, read 10 pages...": "cth. Lari 5 km, baca 10 halaman...",
  "Saving challenge...": "Menyimpan tantangan...",
  "MAKE IT YOURS": "JADIKAN SESUAI DIRI ANDA",
  "Edit your profile.": "Edit profil Anda.",
  "Choose the name you want to see on your journey.": "Pilih nama yang ingin ditampilkan dalam perjalanan Anda.",
  "Display name": "Nama tampilan",
  "Save profile": "Simpan profil",
  "A FRESH ORBIT": "AWAL YANG BARU",
  "Reset your journey?": "Atur ulang perjalanan Anda?",
  "This clears your saved challenges, coins, and preferences on this device. This can’t be undone.": "Tindakan ini menghapus tantangan, koin, dan preferensi tersimpan di perangkat ini. Tindakan ini tidak dapat dibatalkan.",
  "Keep my progress": "Pertahankan progres",
  "Reset everything": "Atur ulang semuanya",
  "YOUR NEXT MILESTONE": "PENCAPAIAN BERIKUTNYA",
  "Your 40-day orbit awaits.": "Perjalanan 40 hari Anda menanti.",
  "Reach Day 40 and complete all your daily challenges to unlock your certificate.": "Capai Hari ke-40 dan selesaikan semua tantangan harian untuk membuka sertifikat.",
  "Go to day 40": "Buka hari ke-40",
  "HELP US GROW": "BANTU KAMI BERKEMBANG",
  "Send a little feedback.": "Kirimkan masukan.",
  "What could make your next orbit even better?": "Apa yang dapat membuat perjalanan Anda berikutnya lebih baik?",
  "Your feedback": "Masukan Anda",
  "Share an idea or tell us how it’s going...": "Bagikan ide atau ceritakan pengalaman Anda...",
  "Send feedback": "Kirim masukan",
  "YOUR ACCOUNT": "AKUN ANDA",
  "Ready to head out?": "Yakin ingin keluar?",
  "You’ll be securely signed out. Your journey progress will stay saved on this device.": "Anda akan keluar dengan aman. Progres perjalanan tetap tersimpan di perangkat ini.",
  "Log out": "Keluar",
  "Close": "Tutup",
  "Download couldn’t be created. Please try again.": "Unduhan gagal dibuat. Silakan coba lagi.",
  "Progress ": "Progres ",
  "in orbit.": "perjalanan.",
  "YOUR 40-DAY CHALLENGE": "TANTANGAN 40 HARI ANDA",
  "Your current phase": "Fase Anda saat ini",
  "Your rank": "Peringkat Anda",
  "Daily leaderboard": "Papan peringkat harian",
  "Target amount": "Jumlah target",
  "Target unit": "Satuan target",
  "Custom target unit": "Satuan target kustom",
  "Enter your unit (e.g. chapters)": "Masukkan satuan (cth. bab)",
  "Back to challenges": "Kembali ke tantangan",
  "APP GUIDE": "PANDUAN APLIKASI",
  "How to Use": "Cara Menggunakan",
  "Points Explained": "Penjelasan Poin",
  "SUPPORT": "DUKUNGAN",
  "Customer Service": "Layanan Pelanggan",
  "Feedback": "Masukan",
  "Log Out": "Keluar",
  "DOWNLOAD PDF": "UNDUH PDF",
  "DOWNLOAD XLSX": "UNDUH XLSX",
  "PDF · Google Drive": "PDF · Google Drive",
  "Excel · Google Drive": "Excel · Google Drive",
  "Your daily leaderboard": "Papan peringkat harian Anda",
  "Daily coin progress over 40 challenge days": "Progres koin harian selama 40 hari tantangan",
  "Your recorded daily coins are shown with a cyan line. Days without recorded progress are left blank.": "Koin harian yang tercatat ditampilkan dengan garis sian. Hari tanpa progres tercatat dibiarkan kosong.",
  "daily leaderboard": "papan peringkat harian",
  "Opening your orbit...": "Membuka perjalanan Anda...",
  "Your journey overview": "Ringkasan perjalanan Anda",
  "YOUR NEXT CHAPTER STARTS HERE": "BAB BARU ANDA DIMULAI DI SINI",
  "Become who": "Jadilah diri yang",
  "you came here to be.": "Anda impikan.",
  "Forty days. A few small promises. A whole new orbit.": "Empat puluh hari. Beberapa komitmen kecil. Perjalanan baru yang bermakna.",
  "Continue your journey": "Lanjutkan perjalanan",
  "DAILY LEADERBOARD": "PAPAN PERINGKAT HARIAN",
  "YOUR RANK": "PERINGKAT ANDA",
  "YOUR CURRENT PHASE": "FASE ANDA SAAT INI",
  "Phase 01": "Fase 01",
  "Awakening": "Awal Kesadaran",
  "Every journey begins with a spark.": "Setiap perjalanan dimulai dari sebuah langkah kecil.",
  "TOTAL COIN": "TOTAL KOIN",
  "TOTAL LIVES": "TOTAL NYAWA",
  "No completed challenge in a day costs 1 life. At 0, 250 coins automatically restore 1 life; without enough coins, your challenge data resets.": "Tidak menyelesaikan tantangan dalam sehari mengurangi 1 nyawa. Saat nyawa habis, 250 koin otomatis ditukar dengan 1 nyawa; jika koin tidak cukup, data tantangan akan diatur ulang.",
  "CHALLENGE START": "TANTANGAN DIMULAI",
  "Change challenge start date, currently": "Ubah tanggal mulai tantangan, saat ini",
  "THE 40-DAY CHALLENGE": "TANTANGAN 40 HARI",
  "Your map to ": "Panduan menuju ",
  "more you.": "versi terbaik diri Anda.",
  "Select a challenge day": "Pilih hari tantangan",
  ", selected": ", dipilih",
  "TODAY": "HARI INI",
  "COMPLETE": "SELESAI",
  "One day at a time. You’re right on track.": "Jalani satu hari demi satu hari. Anda berada di jalur yang tepat.",
  "YOUR DAILY CHALLENGE": "TANTANGAN HARIAN ANDA",
  "DAY ": "HARI ",
  "Focus information is not available for this day.": "Informasi fokus belum tersedia untuk hari ini.",
  "CHALLENGES DONE": "TANTANGAN SELESAI",
  "Add a challenge": "Tambah tantangan",
  "Add challenge": "Tambah tantangan",
  "Edit challenge": "Edit tantangan",
  "COIN": "KOIN",
  "YOUR CHALLENGE": "TANTANGAN ANDA",
  "BODY · MOVEMENT": "TUBUH · GERAK",
  "MIND · LEARNING": "PIKIRAN · BELAJAR",
  "SOUL · REFLECTION": "JIWA · REFLEKSI",
  "Complete ✓": "Selesai ✓",
  "Save progress": "Simpan progres",
  "Save your achievement here, then complete the challenge to receive coins. Reaching the target adds +10 bonus coins; completing without saved progress counts as reaching it.": "Simpan pencapaian Anda di sini, lalu selesaikan tantangan untuk mendapatkan koin. Mencapai target memberi bonus +10 koin; jika progres tidak diisi, penyelesaian dianggap mencapai target.",
  "Your progress": "Progres Anda",
  "Reach the target for +10 bonus coins when you complete this challenge.": "Capai target untuk mendapat bonus +10 koin saat menyelesaikan tantangan.",
  "Progress amount for ": "Jumlah progres untuk ",
  "Saving...": "Menyimpan...",
  "Mark incomplete": "Tandai belum selesai",
  "Completed": "Selesai",
  "Complete challenge": "Selesaikan tantangan",
  "40-day challenge completion": "Penyelesaian tantangan 40 hari",
  "Complete all daily challenges to unlock these actions.": "Selesaikan semua tantangan harian untuk membuka fitur ini.",
  "Complete at least one challenge on each of the 40 days to unlock these actions.": "Selesaikan minimal satu tantangan pada setiap hari selama 40 hari untuk membuka fitur ini.",
  "Complete all challenges to unlock": "Selesaikan semua tantangan untuk membuka",
  "The leaderboard could not be loaded. Please try again.": "Papan peringkat gagal dimuat. Silakan coba lagi.",
  "Loading leaderboard...": "Memuat papan peringkat...",
  "No coins earned in this period yet.": "Belum ada koin yang diperoleh pada periode ini.",
  "Top 10 members by total coins earned.": "10 anggota teratas berdasarkan total koin yang diperoleh.",
  "Leaderboard pagination": "Paginasi papan peringkat",
  "Showing ranks ": "Menampilkan peringkat ",
  " of ": " dari ",
  "Previous leaderboard page": "Halaman papan peringkat sebelumnya",
  "Next leaderboard page": "Halaman papan peringkat berikutnya",
  "Daily coin totals for today's challenge day in WIB.": "Total koin untuk hari tantangan saat ini berdasarkan WIB.",
  "Weekly coin totals for the last 7 days.": "Total koin mingguan selama 7 hari terakhir.",
  "Daily coins": "Koin harian",
  "Weekly coins": "Koin mingguan",
  "JOolo member": "Anggota JOolo",
  "Claim your completion certificate": "Klaim sertifikat penyelesaian",
  "Certificate Claimed": "Sertifikat Diklaim",
  "Claim Certificate": "Klaim Sertifikat",
  "Made for your becoming": "Dibuat untuk perkembangan Anda",
  "Back to the stars ↑": "Kembali ke atas ↑",
  "Create Task": "Buat Tantangan",
  "Back to challenge": "Kembali ke tantangan",
  "Task name": "Nama tantangan",
  "Short description": "Deskripsi singkat",
  "What do you want to achieve?": "Apa yang ingin Anda capai?",
  "Start date": "Hari mulai",
  "End date": "Hari berakhir",
  "Day ": "Hari ",
  " · selected": " · dipilih",
  "Frequency": "Frekuensi",
  "One-Time": "Satu kali",
  "Daily": "Harian",
  "Weekly": "Mingguan",
  "Level": "Tingkat",
  "Easy": "Mudah",
  "Medium": "Menengah",
  "Hard": "Sulit",
  "Total coin": "Total koin",
  "Set automatically from the selected level": "Ditentukan otomatis berdasarkan tingkat",
  "Target (optional)": "Target (opsional)",
  "Amount...": "Jumlah...",
  "Custom / Manual": "Kustom / Manual",
  "Complete with the target achieved for +10 bonus coins. Without a target, completion awards the level coin only.": "Capai target untuk mendapat bonus +10 koin. Tanpa target, penyelesaian hanya memberi koin sesuai tingkat.",
  "Back": "Kembali",
  "Save challenge": "Simpan tantangan",
  "Progress": "Progres",
  "Delete challenge": "Hapus tantangan",
  "Delete this challenge?": "Hapus tantangan ini?",
  "This removes the challenge and its progress from your journey.": "Tantangan beserta progresnya akan dihapus dari perjalanan Anda.",
  "Keep challenge": "Pertahankan tantangan",
  "Update": "Perbarui",
  "Description": "Deskripsi",
  "Automatically set by level; target achievement adds +10 on completion.": "Diatur otomatis berdasarkan tingkat; target tercapai memberi bonus +10 saat selesai.",
  "Achievement": "Pencapaian",
  "Achievement amount": "Jumlah pencapaian",
  "Achievement unit": "Satuan pencapaian",
  "Pages": "Halaman",
  "Minutes": "Menit",
  "Reps": "Repetisi",
  "Glasses": "Gelas",
  "Times": "Kali",
  "Custom": "Kustom",
  "Enter custom unit": "Masukkan satuan kustom",
  "Enter a target amount and unit for this challenge.": "Masukkan jumlah target dan satuannya untuk tantangan ini.",
  "Profile avatar": "Avatar profil",
  "YOUR COSMIC JOURNEY": "PERJALANAN ANDA",
  "Edit profile": "Edit profil",
  "challenges": "tantangan",
  "PREFERENCES": "PREFERENSI",
  "Appearance": "Tampilan",
  "Appearance theme": "Tema tampilan",
  "Dark": "Gelap",
  "Light": "Terang",
  "ACHIEVEMENTS": "PENCAPAIAN",
  "CLAIMED": "DIKLAIM",
  "COMPLETE 40 DAYS": "SELESAIKAN 40 HARI",
  "AVAILABLE ON DAY 40": "TERSEDIA PADA HARI KE-40",
  "DATA": "DATA",
  "Reset Data": "Atur Ulang Data",
  "Clear your progress and start again from day one.": "Hapus progres dan mulai kembali dari hari pertama.",
  "Download ": "Unduh ",
  "YOUR COSMIC TOOLKIT": "PERLENGKAPAN ANDA",
  "Helpful little tools for the person you’re becoming.": "Berbagai alat bantu untuk mendukung perkembangan diri Anda.",
  "Manage bonuses": "Kelola bonus",
  "Close search": "Tutup pencarian",
  "Search bonuses": "Cari bonus",
  "Search guides and trackers...": "Cari panduan dan pelacak...",
  "Search bonus resources": "Cari materi bonus",
  "Bonus resource type": "Jenis materi bonus",
  "E-book downloads": "Unduhan e-book",
  "Tracker downloads": "Unduhan pelacak",
  "E-BOOK": "E-BOOK",
  "TRACKER": "PELACAK",
  "DOWNLOAD ": "UNDUH ",
  "EXCEL": "EXCEL",
  "No resources found in this orbit.": "Materi tidak ditemukan.",
  "Try a different title or category.": "Coba judul atau kategori lain.",
  "Clear search": "Hapus pencarian",
  "Back to your journey ↑": "Kembali ke perjalanan ↑",
  "THE COSMIC COMMUNITY": "KOMUNITAS JOolo",
  "SCORE": "SKOR",
  "Find your ": "Temukan ",
  "orbit.": "lingkaran Anda.",
  "Every small step deserves a few coins.": "Setiap langkah kecil layak dirayakan.",
  "Leaderboard period": "Periode papan peringkat",
  "daily": "harian",
  "weekly": "mingguan",
  "phase": "fase",
  "40-day progress dashboard": "Dasbor progres 40 hari",
  "YOUR 40-DAY JOURNEY": "PERJALANAN 40 HARI ANDA",
  "Progress in orbit.": "Progres perjalanan.",
  "Track your daily coins across your 40-day journey.": "Pantau koin harian Anda sepanjang perjalanan 40 hari.",
  "DAILY COINS": "KOIN HARIAN",
  "Day-by-day progress": "Progres hari demi hari",
  "COINS / DAY": "KOIN / HARI",
  "coins earned": "koin diperoleh",
  "Chart lines": "Garis grafik",
  "You · daily coins": "Anda · koin harian",
  "Your line shows the coins you earned each day. Days without recorded progress are left blank.": "Garis menunjukkan koin yang Anda peroleh setiap hari. Hari tanpa progres tercatat dibiarkan kosong.",
  "COINS EARNED": "KOIN TERKUMPUL",
  "Top three players": "Tiga pemain teratas",
  "Leaderboard ranks": "Peringkat",
  "Your cosmic journey": "Perjalanan Anda",
  "PREVIOUS": "SEBELUMNYA",
  "PAGE ": "HALAMAN ",
  "NEXT": "BERIKUTNYA",
  "BACK TO CHALLENGES": "KEMBALI KE TANTANGAN",
  "Close date picker": "Tutup pemilih tanggal",
  "Input your challenge start date.": "Masukkan tanggal mulai tantangan.",
  "This date is saved to your Supabase account and marks the first day of your 40-day challenge.": "Tanggal ini tersimpan di akun Supabase dan menandai hari pertama tantangan 40 hari Anda.",
  "CHALLENGE START DATE": "TANGGAL MULAI TANTANGAN",
  "Cancel": "Batal",
  "Save start date": "Simpan tanggal mulai",
  "40 days": "40 hari",
  "A MILESTONE WORTH CELEBRATING": "PENCAPAIAN YANG PATUT DIRAYAKAN",
  "JOOLO · CERTIFICATE OF COMPLETION": "JOOLO · SERTIFIKAT PENYELESAIAN",
  "Certificate claimed!": "Sertifikat berhasil diklaim!",
  "Congratulations!": "Selamat!",
  "This recognizes ": "Sertifikat ini diberikan kepada ",
  " for completing the 40-day cosmic growth challenge.": " atas keberhasilan menyelesaikan tantangan pengembangan diri 40 hari.",
  " DAYS · ": " HARI · ",
  " CHALLENGES COMPLETE": " TANTANGAN SELESAI",
  "Your milestone is saved in your journey on this device.": "Pencapaian Anda tersimpan di perangkat ini.",
  "Your 40-day journey is complete. This certificate has been added to your milestones.": "Perjalanan 40 hari Anda selesai. Sertifikat ini telah ditambahkan ke pencapaian Anda.",
  "JOolo home": "Beranda JOolo",
  "PHASE 1": "FASE 1",
  "Choose a day on your 40-day map, complete a small daily challenge, and collect coins as you build consistency. Your progress is saved on this device.": "Pilih hari pada peta 40 hari, selesaikan tantangan harian kecil, dan kumpulkan koin sambil membangun konsistensi. Progres Anda tersimpan di perangkat ini.",
  "Each completed challenge earns the coins shown on its card. Your balance appears here and on your journey dashboard.": "Setiap tantangan yang diselesaikan memberi koin sesuai jumlah pada kartunya. Saldo Anda ditampilkan di sini dan pada dasbor perjalanan.",
  "Challenge progress saved.": "Progres tantangan berhasil disimpan.",
  "Challenge progress updated.": "Progres tantangan berhasil diperbarui.",
  "Challenge removed.": "Tantangan berhasil dihapus.",
  "Custom challenge updated.": "Tantangan kustom berhasil diperbarui.",
  "Custom challenge removed.": "Tantangan kustom berhasil dihapus.",
  "Your journey data has been reset.": "Data perjalanan Anda berhasil diatur ulang.",
  "Challenge start date saved to your account.": "Tanggal mulai tantangan berhasil disimpan ke akun Anda.",
  "Profile updated.": "Profil berhasil diperbarui.",
  "Thanks for helping JOolo grow!": "Terima kasih telah membantu JOolo berkembang!",
  "Certificate could not be generated. Please try again.": "Sertifikat gagal dibuat. Silakan coba lagi.",
  "COMPLETION CERTIFICATE": "SERTIFIKAT PENYELESAIAN",
  "THIS CERTIFICATE IS PROUDLY PRESENTED TO": "SERTIFIKAT INI DIBERIKAN KEPADA",
  "for completing the JOolo 40-day challenge": "atas keberhasilan menyelesaikan tantangan JOolo 40 hari",
  "40-DAY CHALLENGE · COMPLETED": "TANTANGAN 40 HARI · SELESAI",
  "Issued": "Diterbitkan",
  "SOFT SKILLS ASSESSMENT": "PENILAIAN SOFT SKILLS",
  "Soft skills": "Soft skills",
  "Earned coin": "Koin diperoleh",
  "Max coin": "Koin maksimal",
  "Percentage": "Persentase",
  "OVERALL": "TOTAL",
  "Formula: earned coin ÷ max possible coin × 100": "Rumus: koin diperoleh ÷ koin maksimal × 100",
  "Page 2 of 2": "Halaman 2 dari 2",
  "Claim certificate": "Klaim sertifikat",
  "Download certificate again": "Unduh sertifikat lagi",
  "Certificate already claimed": "Sertifikat sudah diklaim",
  "The original certificate details are unavailable, so it cannot be safely regenerated.": "Detail sertifikat asli tidak tersedia, jadi sertifikat tidak dapat dibuat ulang dengan aman.",
  "Certificate status could not be verified. Please try again later.": "Status sertifikat tidak dapat diverifikasi. Silakan coba lagi nanti.",
  "Generating certificate...": "Membuat sertifikat...",
  "Review your certificate": "Periksa sertifikat Anda",
  "This certificate can only be claimed once. Before you confirm, check that your full name and all scores are correct.": "Sertifikat ini hanya dapat diklaim satu kali. Sebelum mengonfirmasi, pastikan nama lengkap dan semua skor sudah sesuai.",
  "Full name on certificate": "Nama lengkap pada sertifikat",
  "Edit full name": "Ubah nama lengkap",
  "Your soft-skill scores": "Skor soft skills Anda",
  "PREVIEW ONLY · NOT ISSUED": "PRATINJAU · BELUM DITERBITKAN",
  "The preview shows the name and scores that will be issued. The final download will include its official issue date and certificate ID.": "Pratinjau menampilkan nama dan skor yang akan diterbitkan. File akhir akan dilengkapi tanggal terbit resmi dan ID sertifikat.",
  "Cancel claim": "Batal klaim",
  "Confirm and download certificate": "Konfirmasi dan unduh sertifikat",
  "Preparing certificate preview...": "Menyiapkan pratinjau sertifikat...",
  "Certificate preview": "Pratinjau sertifikat",
  "Name and scores": "Nama dan skor",
  "You are about to claim your certificate once. Confirm that the name and scores shown above are correct.": "Anda akan mengklaim sertifikat satu kali. Pastikan nama dan skor yang ditampilkan di atas sudah benar.",
  "40-day certificate": "Sertifikat 40 hari",
  "All challenge data was reset because your lives ran out. Your challenge restarts today.": "Semua data tantangan diatur ulang karena nyawa Anda habis. Tantangan dimulai kembali hari ini.",
  "Challenge progress could not be saved: daily challenge was not found.": "Progres tantangan gagal disimpan: tantangan harian tidak ditemukan.",
  "Challenge progress could not be saved: Supabase returned an invalid progress record.": "Progres tantangan gagal disimpan: Supabase mengembalikan data progres yang tidak valid.",
  "Your challenge progress could not be saved: Supabase returned an invalid record.": "Progres tantangan Anda gagal disimpan: Supabase mengembalikan data yang tidak valid.",
  "Your custom challenge could not be updated: Supabase returned an invalid record.": "Tantangan kustom Anda gagal diperbarui: Supabase mengembalikan data yang tidak valid.",
  "Your custom challenge could not be updated: Supabase returned no record.": "Tantangan kustom Anda gagal diperbarui: Supabase tidak mengembalikan data.",
  "Your challenge could not be created: Supabase returned no record.": "Tantangan Anda gagal dibuat: Supabase tidak mengembalikan data.",
  "Enter a valid progress amount of zero or more.": "Masukkan jumlah progres yang valid, yaitu nol atau lebih.",
  "Enter a custom target unit.": "Masukkan satuan target kustom.",
  "Custom challenge completed.": "Tantangan kustom selesai.",
  "Custom challenge marked incomplete.": "Tantangan kustom ditandai belum selesai.",
  "Unexpected error.": "Terjadi kesalahan yang tidak terduga.",
  "PHASE 01": "FASE 01",
  "The 40-Day Blueprint": "Panduan 40 Hari",
  "A gentle, step-by-step guide to build better habits and become your next self.": "Panduan bertahap untuk membangun kebiasaan yang lebih baik dan menjadi versi terbaik diri Anda.",
  "Morning, Made Meaningful": "Pagi yang Lebih Bermakna",
  "Create a calmer, more intentional morning with rituals that actually stick.": "Ciptakan pagi yang lebih tenang dan terarah dengan rutinitas yang konsisten.",
  "Mind Over Momentum": "Pikiran Mengatasi Hambatan",
  "Find your way forward when motivation gets quiet and life gets loud.": "Temukan jalan ke depan saat motivasi meredup dan kehidupan terasa ramai.",
  "Small Steps, Stronger Self": "Langkah Kecil, Diri Lebih Kuat",
  "Simple movement plans to feel stronger, more energized, and at home in your body.": "Rencana gerak sederhana agar tubuh terasa lebih kuat, berenergi, dan nyaman.",
  "40-Day Habit Tracker": "Pelacak Kebiasaan 40 Hari",
  "Track your daily rituals and celebrate every streak across your 40-day challenge.": "Pantau rutinitas harian dan rayakan setiap rangkaian konsistensi selama tantangan 40 hari.",
  "Weekly Movement Log": "Catatan Gerak Mingguan",
  "Record your workouts, movement minutes, and energy levels each week.": "Catat latihan, durasi aktivitas, dan tingkat energi Anda setiap minggu.",
  "Study & Focus Planner": "Perencana Belajar dan Fokus",
  "Plan your learning sessions, focus blocks, and small wins for the week.": "Rencanakan sesi belajar, waktu fokus, dan pencapaian kecil Anda setiap minggu.",
  "Mindful Spending Tracker": "Pelacak Pengeluaran Sadar",
  "Bring intention to spending, saving, and the goals that matter to you.": "Kelola pengeluaran, tabungan, dan tujuan yang penting bagi Anda dengan lebih terarah.",
  "Printable guide  |  PDF": "Panduan cetak  |  PDF",
  "40-day planner  |  XLSX": "Perencana 40 hari  |  XLSX",
  "Weekly planner  |  XLSX": "Perencana mingguan  |  XLSX",
  "Focus": "Fokus",
  "Productivity": "Produktivitas",
  "Mindset": "Pola pikir",
  "Fitness": "Kebugaran",
  "Habit": "Kebiasaan",
  "Study": "Belajar",
  "Finance": "Keuangan",
  "Moon gardener": "Perawat kebun bulan",
  "Word constellation": "Konstelasi kata",
  "Moving meteor": "Meteor yang bergerak",
  "Dawn seeker": "Pencari fajar",
  "Inner galaxy": "Galaksi batin",
  "New horizon": "Cakrawala baru",
};

function translate(text: string, language: Language) {
  if (language !== "id") return text;
  const exactTranslation = indonesianTranslations[text];
  if (exactTranslation) return exactTranslation;

  const dynamicTranslations: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^(\d+) coins were automatically exchanged for (\d+) lives?\.$/, (match) => `${match[1]} koin otomatis ditukar dengan ${match[2]} nyawa.`],
    [/^Challenge added for Day (\d+)–(\d+)\.$/, (match) => `Tantangan ditambahkan untuk Hari ${match[1]}–${match[2]}.`],
    [/^Your journey is now personalized for (women|men)\.$/, (match) => `Preferensi perjalanan Anda disesuaikan untuk ${match[1] === "women" ? "wanita" : "pria"}.`],
    [/^(.+) is ready to download\.$/, (match) => `${match[1]} siap diunduh.`],
  ];
  for (const [pattern, format] of dynamicTranslations) {
    const match = text.match(pattern);
    if (match) return format(match);
  }

  const errorPrefixes: Array<[string, string]> = [
    ["Challenge lives could not be updated: ", "Nyawa tantangan gagal diperbarui: "],
    ["Challenge progress could not be saved: ", "Progres tantangan gagal disimpan: "],
    ["Your challenge progress could not be saved: ", "Progres tantangan Anda gagal disimpan: "],
    ["Your custom challenge could not be updated: ", "Tantangan kustom Anda gagal diperbarui: "],
    ["Your custom challenge could not be deleted: ", "Tantangan kustom Anda gagal dihapus: "],
    ["Your challenge could not be created: ", "Tantangan Anda gagal dibuat: "],
    ["Your saved phase challenge progress could not be reset: ", "Progres tantangan fase tersimpan gagal diatur ulang: "],
    ["Challenge progress was reset, but your coin balance could not be refreshed: ", "Progres tantangan diatur ulang, tetapi saldo koin gagal diperbarui: "],
    ["Your daily challenge progress could not be saved: ", "Progres tantangan harian Anda gagal disimpan: "],
    ["Certificate preview could not be prepared: ", "Pratinjau sertifikat gagal disiapkan: "],
    ["Certificate could not be generated: ", "Sertifikat gagal dibuat: "],
  ];
  const errorPrefix = errorPrefixes.find(([prefix]) => text.startsWith(prefix));
  return errorPrefix ? `${errorPrefix[1]}${text.slice(errorPrefix[0].length)}` : text;
}

function isProcessedChallengeLives(value: unknown): value is ProcessedChallengeLives {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return Number.isInteger(result.lives)
    && Number(result.lives) >= 0
    && Number(result.lives) <= 7
    && typeof result.life_reset === "boolean"
    && typeof result.start_date === "string"
    && Number.isInteger(result.last_evaluated_day)
    && Number.isInteger(result.lives_purchased)
    && Number(result.lives_purchased) >= 0
    && Number.isInteger(result.coin_balance)
    && Number(result.coin_balance) >= 0;
}
type Challenge = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  reward: number;
  accent: "cyan" | "pink" | "gold";
  image: string;
  done: boolean;
  custom?: boolean;
  schedule?: "one-time" | "daily" | "weekly";
  frequency?: number;
  level?: "Easy" | "Medium" | "Hard";
  targetAmount?: number;
  targetUnit?: string;
  phaseFocus?: string;
  phaseGoal?: number;
  phaseTarget?: string;
  dayNumber?: number;
  startDay?: number;
  endDay?: number;
  description?: string;
};

function getPhaseQuestGoal(target: string) {
  const amounts = Array.from(target.matchAll(/\d+(?:[.,]\d+)?/g), ([amount]) => Number(amount.replace(",", ".")));
  return target.toLocaleLowerCase().startsWith("skala") ? amounts.at(-1) : amounts[0];
}

function formatProgressAmount(amount: number) {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function getCurrentChallengeDay(startDate: string) {
  const [year, month, day] = startDate.split("-").map(Number);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const startUtc = Date.UTC(year, month - 1, day);
  return Math.min(40, Math.max(1, Math.floor((todayUtc - startUtc) / 86_400_000) + 1));
}

function getUserDailyQuestReward(quest: Pick<UserDailyQuest, "level" | "target_amount">) {
  return quest.level === "Easy" ? 10 : quest.level === "Medium" ? 20 : 30;
}

const challengeImages: Record<Gender, { run: string; read: string }> = {
  woman: {
    run: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1400&q=85",
    read: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=1400&q=85",
  },
  man: {
    run: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1400&q=85",
    read: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1400&q=85",
  },
};

const taskCoverResources = {
  journal: "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1400&q=85",
  focus: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1400&q=85",
  finance: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=85",
  fitness: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1400&q=85",
};

function getTaskCover(title: string, gender: Gender) {
  const normalizedTitle = title.toLocaleLowerCase();
  if (/read|book|study|learn|page|baca|belajar|membaca/.test(normalizedTitle)) return challengeImages[gender].read;
  if (/run|walk|workout|exercise|fitness|gym|yoga|cycle|swim|lari|jalan|olahraga|latihan/.test(normalizedTitle)) return challengeImages[gender].run;
  if (/journal|write|gratitude|reflect|writing|jurnal|menulis|syukur|refleksi/.test(normalizedTitle)) return taskCoverResources.journal;
  if (/focus|meditat|mindful|breathe|mindset|fokus|meditasi|napas|mindfulness/.test(normalizedTitle)) return taskCoverResources.focus;
  if (/budget|saving|finance|money|spend|uang|tabung|keuangan/.test(normalizedTitle)) return taskCoverResources.finance;
  return challengeImages[gender].run;
}

const initialChallenges: Challenge[] = [
  {
    id: "move",
    title: "Move your body",
    subtitle: "A little stronger, every day.",
    detail: "30 min · Movement · 0 / 30 min",
    reward: 15,
    accent: "cyan",
    image: "",
    done: false,
  },
  {
    id: "read",
    title: "Read 10 pages",
    subtitle: "Feed your curiosity.",
    detail: "Daily · Mindfulness · 0 / 10 pages",
    reward: 20,
    accent: "pink",
    image: "",
    done: false,
  },
  {
    id: "journal",
    title: "Write a gratitude note",
    subtitle: "Notice the good around you.",
    detail: "5 min · Journaling · 0 / 1 entry",
    reward: 10,
    accent: "gold",
    image: "",
    done: false,
  },
];

const bonusResources: Record<BonusType, BonusResource[]> = {
  ebook: [
    { title: "The 40-Day Blueprint", category: "Focus", description: "A gentle, step-by-step guide to build better habits and become your next self.", detail: "Printable guide  |  PDF", image: "photo-1506784983877-45594efa4cbe" },
    { title: "Morning, Made Meaningful", category: "Productivity", description: "Create a calmer, more intentional morning with rituals that actually stick.", detail: "Printable guide  |  PDF", image: "photo-1497250681960-ef046c08a56e" },
    { title: "Mind Over Momentum", category: "Mindset", description: "Find your way forward when motivation gets quiet and life gets loud.", detail: "Printable guide  |  PDF", image: "photo-1519682337058-a94d519337bc" },
    { title: "Small Steps, Stronger Self", category: "Fitness", description: "Simple movement plans to feel stronger, more energized, and at home in your body.", detail: "Printable guide  |  PDF", image: "photo-1518611012118-696072aa579a" },
  ],
  tracker: [
    { title: "40-Day Habit Tracker", category: "Habit", description: "Track your daily rituals and celebrate every streak across your 40-day challenge.", detail: "40-day planner  |  XLSX", image: "photo-1454165804606-c3d57bc86b40", rows: [["Day", "Morning ritual", "Move your body", "Read 10 pages", "Gratitude note", "Notes"]] },
    { title: "Weekly Movement Log", category: "Fitness", description: "Record your workouts, movement minutes, and energy levels each week.", detail: "Weekly planner  |  XLSX", image: "photo-1461896836934-ffe607ba8211", rows: [["Day", "Activity", "Minutes", "Energy (1-5)", "Notes"]] },
    { title: "Study & Focus Planner", category: "Study", description: "Plan your learning sessions, focus blocks, and small wins for the week.", detail: "Weekly planner  |  XLSX", image: "photo-1456324504439-367cee3b3c32", rows: [["Date", "Subject", "Focus goal", "Minutes", "Completed", "Reflection"]] },
    { title: "Mindful Spending Tracker", category: "Finance", description: "Bring intention to spending, saving, and the goals that matter to you.", detail: "Spending planner  |  XLSX", image: "photo-1460925895917-afdab827c52f", rows: [["Date", "Category", "Description", "Amount", "Need or want", "Notes"]] },
  ],
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    star: <><path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" /></>,
    flame: <><path d="M12 22c4.4 0 7-3 7-7 0-3-2-5-4-7-.2 2-1 3-2 3-1-4-4-7-4-7 0 4-4 7-4 12 0 3.4 2.7 6 7 6Z" /><path d="M10 17c0-1.7 1-2.7 2-4 .7 1 2 2 2 4a2 2 0 0 1-4 0Z" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    back: <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.1.8-1.5 2.6-1.3-.5a7.6 7.6 0 0 1-1.5.9l-.2 1.4h-3l-.2-1.4a7.6 7.6 0 0 1-1.5-.9l-1.3.5-1.5-2.6 1.1-.8a7.2 7.2 0 0 1 0-1.8l-1.1-.8 1.5-2.6 1.3.5a7.6 7.6 0 0 1 1.5-.9l.2-1.4h3l.2 1.4a7.6 7.6 0 0 1 1.5.9l1.3-.5 1.5 2.6-1.1.8a7.2 7.2 0 0 1 0 1.8Z" transform="translate(-1 -1) scale(1.08)" /></>,
    certificate: <><circle cx="12" cy="8" r="5" /><path d="m8.5 12-1 9 4.5-2.5 4.5 2.5-1-9M10 8l1.3 1.3L14.5 6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /><path d="m9 16 2 2 4-4" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5ZM4 17a2.5 2.5 0 0 1 2.5-2.5H20M9 7h7M9 10h5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" /></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" /></>,
    support: <><path d="M3 12v-1a9 9 0 0 1 18 0v1" /><path d="M3 12v4a2 2 0 0 0 2 2h2v-6H5a2 2 0 0 0-2 2Zm18 0v4a2 2 0 0 1-2 2h-2v-6h2a2 2 0 0 1 2 2Zm-4 7a5 5 0 0 1-5 2h-2" /></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  };
  return <svg {...common} aria-hidden="true">{paths[name] ?? paths.sparkles}</svg>;
}

function readStored<T>(key: string, fallback: T, userId: string): T {
  try {
    const value = localStorage.getItem(`${userId}:${key}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export default function DashboardClient({
  userId,
  email,
  name,
  avatarUrl,
  isAdmin,
  uploadedResources,
  initialStartDate,
  initialLives,
  initialCoins,
  phaseDailyQuests,
  phaseQuestProgress: initialPhaseQuestProgress,
  userDailyQuests: initialUserDailyQuests,
}: {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string;
  isAdmin: boolean;
  uploadedResources: UploadedBonusResource[];
  initialStartDate: string;
  initialLives: number;
  initialCoins: number;
  phaseDailyQuests: PhaseDailyQuest[];
  phaseQuestProgress: PhaseQuestProgress[];
  userDailyQuests: UserDailyQuest[];
}) {
  const router = useRouter();
  const [gender, setGender] = useState<Gender>("woman");
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges);
  const [selectedDay, setSelectedDay] = useState(1);
  const [journeyStartDate, setJourneyStartDate] = useState(initialStartDate);
  const [lives, setLives] = useState(initialLives);
  const [dailyStardustByDay, setDailyStardustByDay] = useState<Record<string, number>>({});
  const [challengeCompletionDays, setChallengeCompletionDays] = useState<Record<string, number>>({});
  const [journeyStartDateDraft, setJourneyStartDateDraft] = useState(initialStartDate);
  const [journeyDatePickerOpen, setJourneyDatePickerOpen] = useState(false);
  const [journeyDateSaving, setJourneyDateSaving] = useState(false);
  const [journeyDateError, setJourneyDateError] = useState("");
  const [phaseQuestProgressById, setPhaseQuestProgressById] = useState<Record<string, PhaseQuestProgress>>(
    () => Object.fromEntries(initialPhaseQuestProgress.map((progress) => [progress.quest_id, progress])),
  );
  const [completedPhaseQuestIds, setCompletedPhaseQuestIds] = useState(
    () => initialPhaseQuestProgress.filter((progress) => progress.completed_at !== null).map((progress) => progress.quest_id),
  );
  const [phaseProgressDrafts, setPhaseProgressDrafts] = useState<Record<string, string>>({});
  const [pendingPhaseQuestIds, setPendingPhaseQuestIds] = useState<string[]>([]);
  const [userDailyQuests, setUserDailyQuests] = useState(initialUserDailyQuests);
  const [pendingUserDailyQuestIds, setPendingUserDailyQuestIds] = useState<string[]>([]);
  const [userQuestProgressDrafts, setUserQuestProgressDrafts] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState(initialCoins);
  const [modalOpen, setModalOpen] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskSchedule, setTaskSchedule] = useState<"one-time" | "daily" | "weekly">("one-time");
  const [taskLevel, setTaskLevel] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStartDay, setTaskStartDay] = useState(1);
  const [taskEndDay, setTaskEndDay] = useState(1);
  const [taskTargetAmount, setTaskTargetAmount] = useState("");
  const [taskUnit, setTaskUnit] = useState("pages");
  const [customTaskUnit, setCustomTaskUnit] = useState("");
  const [progressChallengeId, setProgressChallengeId] = useState<string | null>(null);
  const [progressTitle, setProgressTitle] = useState("");
  const [progressDescription, setProgressDescription] = useState("");
  const [progressSchedule, setProgressSchedule] = useState<"one-time" | "daily" | "weekly">("one-time");
  const [progressLevel, setProgressLevel] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [progressStartDay, setProgressStartDay] = useState(1);
  const [progressEndDay, setProgressEndDay] = useState(1);
  const [progressTarget, setProgressTarget] = useState("");
  const [progressUnit, setProgressUnit] = useState("pages");
  const [progressCustomUnit, setProgressCustomUnit] = useState("");
  const [confirmChallengeDelete, setConfirmChallengeDelete] = useState(false);
  const [completionDialog, setCompletionDialog] = useState<CompletionDialog>(null);
  const [certificateClaimed, setCertificateClaimed] = useState(false);
  const [certificateStatusLoaded, setCertificateStatusLoaded] = useState(false);
  const [claimedCertificate, setClaimedCertificate] = useState<ClaimedCertificate | null>(null);
  const [certificateGenerating, setCertificateGenerating] = useState(false);
  const [certificateConfirmationOpen, setCertificateConfirmationOpen] = useState(false);
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState<string | null>(null);
  const [certificatePreviewRows, setCertificatePreviewRows] = useState<CertificateAssessmentRow[]>([]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDialog, setProfileDialog] = useState<ProfileDialog>(null);
  const [profileName, setProfileName] = useState(name);
  const [profileTheme, setProfileTheme] = useState<ProfileTheme>("dark");
  const [expandedGuide, setExpandedGuide] = useState<"how" | "points" | null>(null);
  const [bonusType, setBonusType] = useState<BonusType>("ebook");
  const [bonusSearchOpen, setBonusSearchOpen] = useState(false);
  const [bonusSearch, setBonusSearch] = useState("");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>("weekly");
  const [coinLeaderboard, setCoinLeaderboard] = useState<CoinLeaderboardEntry[]>([]);
  const [dailyLeaderboardRank, setDailyLeaderboardRank] = useState(0);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const livesProcessingRef = useRef(false);
  const t = (text: string) => translate(text, language);
  const languageSelector = (
    <label className="language-selector">
      <Icon name="globe" size={20} />
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(event) => setLanguage(event.currentTarget.value as Language)}
      >
        <option value="en">English</option>
        <option value="id">Indonesia</option>
      </select>
      <Icon name="chevron" size={14} />
    </label>
  );

  useEffect(() => {
    setGender(readStored<Gender>("joolo-gender", "woman", userId));
    setChallenges(readStored<Challenge[]>("joolo-challenges", initialChallenges, userId));
    setJourneyStartDate(initialStartDate);
    setCoins(initialCoins);
    setDailyStardustByDay(readStored<Record<string, number>>("joolo-daily-stardust", {}, userId));
    setChallengeCompletionDays(readStored<Record<string, number>>("joolo-challenge-completion-days", {}, userId));
    setProfileName(readStored<string>("joolo-profile-name", name, userId));
    setProfileTheme(readStored<ProfileTheme>("joolo-profile-theme", "dark", userId));
    setLanguage(readStored<Language>("joolo-language", "en", userId));
    setHydrated(true);
  }, [userId, name, initialStartDate, initialCoins]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(`${userId}:joolo-gender`, JSON.stringify(gender));
    localStorage.setItem(`${userId}:joolo-challenges`, JSON.stringify(challenges));
    localStorage.setItem(`${userId}:joolo-daily-stardust`, JSON.stringify(dailyStardustByDay));
    localStorage.setItem(`${userId}:joolo-challenge-completion-days`, JSON.stringify(challengeCompletionDays));
    localStorage.setItem(`${userId}:joolo-profile-name`, JSON.stringify(profileName));
    localStorage.setItem(`${userId}:joolo-profile-theme`, JSON.stringify(profileTheme));
    localStorage.setItem(`${userId}:joolo-language`, JSON.stringify(language));
  }, [gender, challenges, dailyStardustByDay, challengeCompletionDays, coins, profileName, profileTheme, language, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) return;
    setCertificateStatusLoaded(false);
    let active = true;

    async function loadClaimedCertificate() {
      try {
        const { data, error } = await createClient().rpc("get_40_day_certificate");
        if (error) throw new Error(error.message);
        const records = Array.isArray(data) ? data : data ? [data] : [];
        if (records.length > 1) throw new Error("Supabase returned multiple certificate records for one user");
        if (!active) return;
        if (records.length === 0) {
          setCertificateClaimed(false);
          setClaimedCertificate(null);
          setCertificateStatusLoaded(true);
          return;
        }

        const record = records[0];
        if (!isRecord(record)) throw new Error("Supabase returned an invalid certificate record");
        setCertificateClaimed(true);
        if (record.assessment_snapshot === null || typeof record.certificate_name !== "string" || !record.certificate_name.trim()) {
          setClaimedCertificate(null);
        } else {
          setClaimedCertificate(parseClaimedCertificate(record));
        }
        setCertificateStatusLoaded(true);
      } catch (error) {
        if (!active) return;
        console.error("Unable to verify claimed certificate status", error);
        notify("Certificate status could not be verified. Please try again later.", 10000);
      }
    }

    void loadClaimedCertificate();
    return () => {
      active = false;
    };
  }, [hydrated, userId]);

  useEffect(() => {
    let active = true;
    const period = leaderboardOpen && leaderboardPeriod !== "phase" ? leaderboardPeriod : "daily";
    setLeaderboardLoading(true);
    setLeaderboardError("");
    setCoinLeaderboard([]);

    async function loadLeaderboard() {
      try {
        const { data, error } = await createClient().rpc("get_coin_leaderboard", {
          p_period: period,
        });
        if (error) throw new Error(error.message);
        const entries = parseCoinLeaderboard(data);
        if (active) {
          setCoinLeaderboard(entries);
          if (period === "daily") {
            setDailyLeaderboardRank(entries.find((entry) => entry.userId === userId)?.rank ?? 0);
          }
        }
      } catch (error) {
        if (!active) return;
        console.error("Unable to load coin leaderboard", error);
        setCoinLeaderboard([]);
        if (period === "daily") setDailyLeaderboardRank(0);
        setLeaderboardError("The leaderboard could not be loaded. Please try again.");
      } finally {
        if (active) setLeaderboardLoading(false);
      }
    }

    void loadLeaderboard();
    return () => {
      active = false;
    };
  }, [leaderboardOpen, leaderboardPeriod, userId]);

  useEffect(() => {
    return () => {
      if (certificatePreviewUrl) URL.revokeObjectURL(certificatePreviewUrl);
    };
  }, [certificatePreviewUrl]);

  useEffect(() => {
    if (!hydrated || livesProcessingRef.current) return;
    livesProcessingRef.current = true;

    async function processLives() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("process_challenge_lives", {
          p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });

        if (error) {
          throw new Error(error.message);
        }

        const result = Array.isArray(data) ? data[0] : data;
        if (!isProcessedChallengeLives(result)) {
          throw new Error("Supabase returned an invalid challenge lives state.");
        }

        setLives(result.lives);
        setCoins(result.coin_balance);
        if (result.life_reset) {
          setJourneyStartDate(result.start_date);
          setJourneyStartDateDraft(result.start_date);
          setSelectedDay(1);
          setPhaseQuestProgressById({});
          setCompletedPhaseQuestIds([]);
          setPhaseProgressDrafts({});
          setUserDailyQuests([]);
          setUserQuestProgressDrafts({});
          setChallenges(initialChallenges);
          setDailyStardustByDay({});
          setChallengeCompletionDays({});
          [
            "joolo-challenges",
            "joolo-daily-stardust",
            "joolo-challenge-completion-days",
            "joolo-coins",
          ].forEach((key) => localStorage.removeItem(`${userId}:${key}`));
          notify("All challenge data was reset because your lives ran out. Your challenge restarts today.");
          router.refresh();
          return;
        }

        if (result.lives_purchased > 0) {
          notify(`${result.lives_purchased * 250} coins were automatically exchanged for ${result.lives_purchased} ${result.lives_purchased === 1 ? "life" : "lives"}.`);
        }
      } catch (error) {
        notify(`Challenge lives could not be updated: ${error instanceof Error ? error.message : "Unexpected error."}`);
      }
    }

    void processLives();
  }, [hydrated, router, userId]);

  const phaseQuestsForSelectedDay = phaseDailyQuests
    .filter((quest) => quest.day_number === selectedDay)
    .map<Challenge>((quest) => {
      const progress = phaseQuestProgressById[quest.id];
      const achievedAmount = progress?.achieved_amount ?? 0;
      return {
        id: quest.id,
        title: quest.task_name,
        subtitle: quest.short_description,
        detail: `${quest.frequency} · ${quest.level} · ${formatProgressAmount(achievedAmount)} / ${quest.target}`,
        reward: quest.total_coin,
        accent: quest.level === "Easy" ? "cyan" : quest.level === "Medium" ? "pink" : "gold",
        image: "",
        done: completedPhaseQuestIds.includes(quest.id),
        level: quest.level,
        phaseFocus: quest.focus,
        phaseGoal: getPhaseQuestGoal(quest.target),
        phaseTarget: quest.target,
      };
    });
  const userQuestsForSelectedDay = userDailyQuests
    .filter((quest) => quest.start_date <= selectedDay && quest.end_date >= selectedDay)
    .map<Challenge>((quest) => {
      const targetDetail = quest.target_amount === null
        ? "Target open"
        : `${formatProgressAmount(quest.achieved_amount)} / ${formatProgressAmount(quest.target_amount)} ${quest.target_unit}`;
      const schedule = quest.frequency === "Daily"
        ? "daily"
        : quest.frequency === "Weekly"
          ? "weekly"
          : "one-time";
      const detail = `${schedule} · ${quest.level} · ${targetDetail}`;
      return {
        id: quest.id,
        title: quest.task_name,
        subtitle: quest.short_description || detail,
        detail,
        reward: getUserDailyQuestReward(quest),
        accent: quest.level === "Easy" ? "cyan" : quest.level === "Medium" ? "pink" : "gold",
        image: "",
        done: quest.is_completed,
        custom: true,
        schedule,
        level: quest.level,
        targetAmount: quest.target_amount ?? undefined,
        targetUnit: quest.target_unit ?? undefined,
        dayNumber: quest.start_date,
        startDay: quest.start_date,
        endDay: quest.end_date,
        description: quest.short_description,
      };
    });
  const selectedPhase = phaseDailyQuests.find((quest) => quest.day_number === selectedDay);
  const currentPhase = phaseDailyQuests.find((quest) => quest.day_number === getCurrentChallengeDay(journeyStartDate)) ?? selectedPhase;
  const activeChallenges = phaseQuestsForSelectedDay.length > 0
    ? [...phaseQuestsForSelectedDay, ...userQuestsForSelectedDay, ...challenges.filter((challenge) => challenge.custom && (!challenge.dayNumber || challenge.dayNumber === selectedDay))]
    : [...challenges.filter((challenge) => !challenge.custom), ...userQuestsForSelectedDay, ...challenges.filter((challenge) => challenge.custom && (!challenge.dayNumber || challenge.dayNumber === selectedDay))];
  const completed = activeChallenges.filter((challenge) => challenge.done).length;
  const journeyStartDateLabel = new Date(`${journeyStartDate}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dayNumber = Math.max(selectedDay, 1);
  const completedPhaseDays = new Set(
    phaseDailyQuests
      .filter((quest) => completedPhaseQuestIds.includes(quest.id))
      .map((quest) => quest.day_number),
  );
  const canClaimCertificate = Array.from({ length: 40 }, (_, index) => index + 1)
    .every((day) => completedPhaseDays.has(day));
  const progress = Math.round((completed / Math.max(activeChallenges.length, 1)) * 100);
  const rankedLeaderboard = coinLeaderboard.filter((leader) => leader.rank <= 100);
  const topTenLeaders = rankedLeaderboard.slice(0, 10);
  const topLeaders = topTenLeaders.slice(0, 3);
  const remainingTopTenLeaders = topTenLeaders.slice(3);
  const chartBounds = { left: 72, top: 20, width: 820, height: 270 };
  const chartMaxValue = Math.max(0, ...Object.values(dailyStardustByDay));
  const chartYMax = chartMaxValue > 500 ? 1000 : 500;
  const chartX = (day: number) => chartBounds.left + ((day - 1) / 39) * chartBounds.width;
  const chartY = (score: number) => chartBounds.top + chartBounds.height - (score / chartYMax) * chartBounds.height;
  const userRecordedPoints = Array.from({ length: 40 }, (_, index) => ({
    day: index + 1,
    score: dailyStardustByDay[String(index + 1)],
  })).filter((point): point is { day: number; score: number } => typeof point.score === "number");
  const userTrendSegments: Array<Array<{ day: number; score: number }>> = [];
  userRecordedPoints.forEach((point) => {
    const lastSegment = userTrendSegments[userTrendSegments.length - 1];
    if (lastSegment && lastSegment[lastSegment.length - 1].day === point.day - 1) {
      lastSegment.push(point);
    } else {
      userTrendSegments.push([point]);
    }
  });
  const userTotalRecordedStardust = Object.values(dailyStardustByDay).reduce((total, score) => total + score, 0);
  const visibleBonusResources = bonusResources[bonusType].filter((resource) =>
    `${resource.title} ${resource.category} ${resource.description}`.toLowerCase().includes(bonusSearch.trim().toLowerCase()),
  );
  const visibleUploadedResources = uploadedResources.filter((resource) =>
    resource.type === bonusType
    && `${resource.title} ${resource.description}`.toLowerCase().includes(bonusSearch.trim().toLowerCase()),
  );
  const taskReward = taskLevel === "Easy" ? 10 : taskLevel === "Medium" ? 20 : 30;

  function notify(message: string, duration = 2600) {
    setToast(t(message));
    window.setTimeout(() => setToast(""), duration);
  }

  function getCertificateAssessmentRows(): CertificateAssessmentRow[] {
    const certificateSkillsById = new Map<string, (typeof certificateSkillOrder)[number]>(
      certificateSkillOrder.map((skill) => [skill.skillCategoryId, skill] as const),
    );
    const assessmentsBySkill = new Map<string, SoftSkillAssessment>();
    for (const quest of phaseDailyQuests) {
      const configuredSkill = certificateSkillsById.get(quest.skill_category_id);
      if (!configuredSkill) {
        throw new Error(`The certificate template does not include skill category ${quest.skill_category_id}`);
      }
      const softSkills = quest.soft_skills.trim();
      if (softSkills !== configuredSkill.softSkills) {
        throw new Error(`Skill ${quest.skill_category_id} has an unexpected soft-skill name`);
      }
      const assessment = assessmentsBySkill.get(quest.skill_category_id) ?? {
        skillCategoryId: quest.skill_category_id,
        softSkills,
        earnedCoin: 0,
        maxPossibleCoin: 0,
      };
      if (assessment.softSkills !== softSkills) {
        throw new Error(`Skill ${quest.skill_category_id} has inconsistent soft-skill names`);
      }
      const questProgress = phaseQuestProgressById[quest.id];
      assessment.earnedCoin += questProgress?.completed_at ? questProgress.earned_coin : 0;
      assessment.maxPossibleCoin += quest.max_possible_coin;
      assessmentsBySkill.set(quest.skill_category_id, assessment);
    }
    if (assessmentsBySkill.size !== certificateSkillOrder.length) {
      throw new Error("The certificate template requires all six configured soft-skill categories");
    }
    return certificateSkillOrder.map((skill) => {
      const { skillCategoryId, softSkills } = skill;
      const assessment = assessmentsBySkill.get(skillCategoryId);
      if (!assessment || assessment.softSkills !== softSkills) {
        throw new Error(`The certificate template is missing configured category ${skillCategoryId}`);
      }
      return { ...skill, assessment };
    });
  }

  async function buildCompletionCertificatePdf(
    verificationCode: string,
    issuedAtValue: string,
    assessmentRows: CertificateAssessmentRow[],
    preview = false,
    certificateName = profileName.trim() || email || "JOolo member",
  ) {
      const templateResponse = await fetch("/certificates/joolo-40-day-template-clean.pdf");
      if (!templateResponse.ok) {
        throw new Error(`Could not load certificate design: HTTP ${templateResponse.status}`);
      }
      const document = await PDFDocument.load(new Uint8Array(await templateResponse.arrayBuffer()));
      if (document.getPageCount() !== 2) {
        throw new Error("The certificate design must contain exactly two pages");
      }
      const font = await document.embedFont(StandardFonts.Helvetica);
      const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
      const nameFont = await document.embedFont(StandardFonts.TimesRomanItalic);
      const certificatePage = document.getPage(0);
      const assessmentPage = document.getPage(1);
      const pageWidth = certificatePage.getWidth();
      const darkBackground = rgb(9 / 255, 21 / 255, 34 / 255);
      const cyan = rgb(0.36, 0.95, 0.89);
      const gold = rgb(0.94, 0.79, 0.49);
      const pdfText = (value: string) => value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replaceAll("÷", "/")
        .replaceAll("×", "x")
        .replaceAll("·", "-")
        .replaceAll("–", "-")
        .replace(/[^\x20-\x7E]/g, " ");
      const issuedDate = preview ? "PREVIEW ONLY" : new Date(issuedAtValue).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).toLocaleUpperCase("id-ID");
      const safeName = pdfText(certificateName);
      const nameFontSize = Math.min(42, 345 / nameFont.widthOfTextAtSize(safeName, 42) * 42);
      certificatePage.drawRectangle({ x: 323, y: 337, width: 196, height: 53, color: darkBackground });
      certificatePage.drawText(safeName, {
        x: (pageWidth - nameFont.widthOfTextAtSize(safeName, nameFontSize)) / 2,
        y: 347,
        size: nameFontSize,
        font: nameFont,
        color: rgb(0.94, 0.96, 1),
      });
      const safeVerificationCode = pdfText(verificationCode);
      const verificationCodeFontSize = Math.min(
        10,
        310 / boldFont.widthOfTextAtSize(safeVerificationCode, 10) * 10,
      );
      certificatePage.drawText(pdfText(verificationCode), {
        x: 70,
        y: 86,
        size: verificationCodeFontSize,
        font: boldFont,
        color: rgb(0.76, 0.82, 0.9),
      });
      certificatePage.drawText(pdfText(`DITERBITKAN ${issuedDate}`), {
        x: 70,
        y: 60,
        size: 10.5,
        font: boldFont,
        color: rgb(0.62, 0.69, 0.8),
      });

      const assessments = assessmentRows.map(({ assessment }) => assessment);
      const totals = assessments.reduce(
        (total, assessment) => ({
          earnedCoin: total.earnedCoin + assessment.earnedCoin,
          maxPossibleCoin: total.maxPossibleCoin + assessment.maxPossibleCoin,
        }),
        { earnedCoin: 0, maxPossibleCoin: 0 },
      );
      const percentageValue = (earnedCoin: number, maxPossibleCoin: number) =>
        maxPossibleCoin > 0 ? (earnedCoin / maxPossibleCoin) * 100 : 0;
      const percentage = (earnedCoin: number, maxPossibleCoin: number) =>
        `${percentageValue(earnedCoin, maxPossibleCoin).toFixed(1)}%`;

      const contentStream = assessmentPage.node.Contents();
      if (!(contentStream instanceof PDFRawStream)) {
        throw new Error("The certificate assessment page has an unsupported PDF content layout");
      }
      const streamText = new TextDecoder().decode(decodePDFRawStream(contentStream).decode());
      const skillLabelReplacements: { y: number; value: string }[] = assessmentRows.flatMap((row) => {
          const labelValue = "labelValue" in row ? row.labelValue : row.assessment.softSkills;
          const label = {
            y: row.labelBaseline,
            value: labelValue,
          };
          if (!("continuationBaseline" in row)) return [label];
          return [
            label,
            {
              y: row.continuationBaseline,
              value: row.continuationLabel,
            },
          ];
        });
      const encodePdfText = (value: string) =>
        Array.from(value, (character) => character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
      const skillLabelPattern =
        /(1 0 0 1 120 ([\d.]+) Tm\s*)(?:<[\dA-Fa-f]*>\s*Tj|\[[\s\S]*?\]\s*TJ)/g;
      const skillLabelFields = Array.from(streamText.matchAll(skillLabelPattern)).filter(([, , yText]) => {
        const baseline = Number(yText);
        return baseline >= 160 && baseline <= 390;
      });
      if (skillLabelFields.length !== skillLabelReplacements.length) {
        throw new Error(
          `The certificate template must contain ${skillLabelReplacements.length} skill-name fields; found ${skillLabelFields.length}`,
        );
      }
      const skillLabelReplacementByOffset = new Map(
        [...skillLabelFields]
          .sort((first, second) => Number(second[2]) - Number(first[2]))
          .map((field, index) => [field.index, skillLabelReplacements[index]]),
      );
      let updatedStreamText = streamText.replace(
        skillLabelPattern,
        (operator, prefix: string, yText: string, fieldOffset: number) => {
          if (Number(yText) < 160 || Number(yText) > 390) return operator;
          const replacement = skillLabelReplacementByOffset.get(fieldOffset);
          if (!replacement) return operator;
          const positionedPrefix = prefix.replace(
            /(1 0 0 1 120 )[\d.]+( Tm\s*)$/,
            (_, start: string, end: string) => `${start}${replacement.y}${end}`,
          );
          return `${positionedPrefix}<${encodePdfText(replacement.value)}> Tj`;
        },
      );

      const maximumScoreReplacementCounts = Array(assessmentRows.length).fill(0);
      updatedStreamText = updatedStreamText.replace(
        /(\/F0 ([\d.]+) Tf\s*([\d.]+) Tz\s*1 0 0 1 )([\d.]+) ([\d.]+) Tm\s*<([\dA-Fa-f]+)>\s*Tj/g,
        (
          operator,
          fontPrefix: string,
          fontSizeText: string,
          horizontalScaleText: string,
          xText: string,
          yText: string,
          originalValueHex: string,
        ) => {
          const rowIndex = assessmentRows.findIndex(({ maximumScoreBaseline }) =>
            Math.abs(maximumScoreBaseline - Number(yText)) < 0.01,
          );
          if (rowIndex < 0) return operator;
          const originalValue = originalValueHex.match(/.{4}/g)
            ?.map((character) => String.fromCharCode(parseInt(character, 16)))
            .join("");
          if (!originalValue || !/^\d[\d.]*$/.test(originalValue)) return operator;
          maximumScoreReplacementCounts[rowIndex] += 1;
          const fontSize = Number(fontSizeText);
          const horizontalScale = Number(horizontalScaleText) / 100;
          const glyphWidth = (character: string) => character === "." ? 278 : 556;
          const textWidth = (value: string) =>
            Array.from(value).reduce((width, character) => width + glyphWidth(character), 0)
            * fontSize * horizontalScale / 1000;
          const rightEdge = Number(xText) + textWidth(originalValue);
          const value = assessmentRows[rowIndex].assessment.maxPossibleCoin.toLocaleString("id-ID");
          const x = rightEdge - textWidth(value);
          return `${fontPrefix}${x.toFixed(2)} ${yText} Tm\n<${encodePdfText(value)}> Tj`;
        },
      );
      if (maximumScoreReplacementCounts.some((count) => count !== 1)) {
        throw new Error("The certificate template is missing one or more maximum-score fields");
      }

      const pageTwoReplacements = [
        ...assessmentRows.flatMap(({
          assessment,
          earnedScoreFieldX,
          earnedScoreBaseline,
          percentageBaseline,
        }) => [
          { x: earnedScoreFieldX, y: earnedScoreBaseline, value: String(assessment.earnedCoin) },
          {
            x: 741.9,
            y: percentageBaseline,
            value: percentage(assessment.earnedCoin, assessment.maxPossibleCoin),
          },
        ]),
        { x: 487.64, y: 123.52, value: String(totals.earnedCoin) },
        { x: 738.82, y: 124.09, value: percentage(totals.earnedCoin, totals.maxPossibleCoin) },
        { x: 67.5, y: 58.46, value: `DITERBITKAN ${issuedDate}` },
        { x: 374.95, y: 58.46, value: `ID: ${verificationCode}` },
      ];
      const replacementCounts = new Map(pageTwoReplacements.map((replacement) => [replacement, 0]));
      const replacedStreamText = updatedStreamText.replace(
        /1 0 0 1 ([\d.]+) ([\d.]+) Tm\s*<([0-9A-Fa-f]+)>\s*Tj/g,
        (operator, xText: string, yText: string) => {
          const x = Number(xText);
          const y = Number(yText);
          const replacement = pageTwoReplacements.find((item) =>
            Math.abs(item.x - x) < 0.01 && Math.abs(item.y - y) < 0.01,
          );
          if (!replacement) return operator;
          replacementCounts.set(replacement, (replacementCounts.get(replacement) ?? 0) + 1);
          return operator.replace(/<([0-9A-Fa-f]+)>\s*Tj$/, "<> Tj");
        },
      );
      if (pageTwoReplacements.some((replacement) => replacementCounts.get(replacement) !== 1)) {
        throw new Error("The certificate template is missing one or more expected assessment text fields");
      }
      const updatedContentStream = document.context.flateStream(replacedStreamText);
      assessmentPage.node.set(
        PDFName.of("Contents"),
        document.context.register(updatedContentStream),
      );
      const scoreColor = rgb(0.91, 0.94, 0.98);
      const percentageColor = rgb(0.36, 0.95, 0.89);
      const drawVisibleValue = (
        centerX: number,
        baseline: number,
        value: string,
        fontSize: number,
        color: typeof percentageColor,
      ) => {
        const safeText = pdfText(value);
        const textWidth = boldFont.widthOfTextAtSize(safeText, fontSize);
        assessmentPage.drawText(safeText, {
          x: centerX - textWidth / 2,
          y: baseline,
          size: fontSize,
          font: boldFont,
          color,
        });
      };
      const drawProgressBar = (baseline: number, value: number) => {
        const startX = 618.75;
        const barWidth = 100.25;
        const barHeight = 5.8;
        const radius = barHeight / 2;
        const fillWidth = barWidth * Math.min(100, Math.max(0, value)) / 100;
        if (fillWidth <= 0) return;
        const y = baseline - 0.05;
        const capRadius = Math.min(radius, fillWidth / 2);
        assessmentPage.drawCircle({
          x: startX + capRadius,
          y: y + radius,
          size: capRadius,
          color: percentageColor,
        });
        if (fillWidth > capRadius) {
          assessmentPage.drawRectangle({
            x: startX + capRadius,
            y,
            width: fillWidth - capRadius,
            height: barHeight,
            color: percentageColor,
          });
        }
      };
      assessmentRows.forEach(({
        assessment,
        earnedScoreBaseline,
        percentageBaseline,
        scoreCenter,
      }) => {
        drawVisibleValue(
          scoreCenter,
          earnedScoreBaseline,
          String(assessment.earnedCoin),
          11.25,
          scoreColor,
        );
        drawVisibleValue(
          754.95,
          percentageBaseline,
          percentage(assessment.earnedCoin, assessment.maxPossibleCoin),
          10.5,
          percentageColor,
        );
        drawProgressBar(
          percentageBaseline,
          percentageValue(assessment.earnedCoin, assessment.maxPossibleCoin),
        );
      });
      drawVisibleValue(502.2, 123.52, String(totals.earnedCoin), 15, scoreColor);
      drawVisibleValue(
        750.03,
        124.09,
        percentage(totals.earnedCoin, totals.maxPossibleCoin),
        12.75,
        percentageColor,
      );
      drawProgressBar(124.09, percentageValue(totals.earnedCoin, totals.maxPossibleCoin));
      assessmentPage.drawText(pdfText(`DITERBITKAN ${issuedDate}`), {
        x: 67.5,
        y: 58.46,
        size: 7.5,
        font: boldFont,
        color: rgb(0.62, 0.69, 0.8),
      });
      assessmentPage.drawText(pdfText(`ID: ${verificationCode}`), {
        x: 374.95,
        y: 58.46,
        size: 7.5,
        font: boldFont,
        color: rgb(0.62, 0.69, 0.8),
      });

      return document.save();
  }

  function downloadCompletionCertificate(pdfBytes: Uint8Array, verificationCode: string) {
    const url = URL.createObjectURL(new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `joolo-40-day-${verificationCode.toLowerCase().replaceAll("/", "-")}.pdf`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function closeCertificateConfirmation() {
    if (certificateGenerating) return;
    setCertificateConfirmationOpen(false);
    setCertificatePreviewUrl(null);
    setCertificatePreviewRows([]);
  }

  async function openCertificateConfirmation() {
    if (!canClaimCertificate || !certificateStatusLoaded || certificateGenerating) return;
    if (certificateClaimed) {
      if (claimedCertificate) {
        await downloadClaimedCompletionCertificate(claimedCertificate);
      } else {
        notify("The original certificate details are unavailable, so it cannot be safely regenerated.", 10000);
      }
      return;
    }
    setCertificateGenerating(true);
    try {
      const assessmentRows = getCertificateAssessmentRows();
      const previewBytes = await buildCompletionCertificatePdf("PREVIEW", "", assessmentRows, true);
      const previewUrl = URL.createObjectURL(
        new Blob([previewBytes.buffer as ArrayBuffer], { type: "application/pdf" }),
      );
      setCertificatePreviewRows(assessmentRows);
      setCertificatePreviewUrl(previewUrl);
      setCertificateConfirmationOpen(true);
    } catch (error) {
      console.error("Unable to prepare completion certificate preview", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      notify(`Certificate preview could not be prepared: ${errorMessage}`, 10000);
    } finally {
      setCertificateGenerating(false);
    }
  }

  async function downloadClaimedCompletionCertificate(certificate: ClaimedCertificate) {
    if (certificateGenerating) return;
    setCertificateGenerating(true);
    try {
      const pdfBytes = await buildCompletionCertificatePdf(
        certificate.verificationCode,
        certificate.issuedAt,
        certificate.assessmentRows,
        false,
        certificate.fullName,
      );
      downloadCompletionCertificate(pdfBytes, certificate.verificationCode);
      setCompletionDialog("certificate");
    } catch (error) {
      console.error("Unable to generate completion certificate", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      notify(`Certificate could not be generated: ${errorMessage}`, 10000);
    } finally {
      setCertificateGenerating(false);
    }
  }

  async function claimCompletionCertificate() {
    if (!canClaimCertificate || !certificateStatusLoaded || certificateClaimed || certificateGenerating || !certificateConfirmationOpen) return;
    setCertificateGenerating(true);
    try {
      const supabase = createClient();
      const certificateName = profileName.trim() || email || "JOolo member";
      const { data: certificateData, error: certificateError } = await supabase.rpc("issue_40_day_certificate", {
        p_certificate_name: certificateName,
        p_assessment_snapshot: certificatePreviewRows.map(({ skillCategoryId, assessment }) => ({
          skillCategoryId,
          softSkills: assessment.softSkills,
          earnedCoin: assessment.earnedCoin,
          maxPossibleCoin: assessment.maxPossibleCoin,
        })),
      });
      if (certificateError) throw new Error(`Could not issue certificate: ${certificateError.message}`);
      const certificate = Array.isArray(certificateData) ? certificateData[0] : certificateData;
      if (
        isRecord(certificate)
        && (certificate.assessment_snapshot === null
          || typeof certificate.certificate_name !== "string"
          || !certificate.certificate_name.trim())
      ) {
        setCertificateClaimed(true);
        setClaimedCertificate(null);
        setCertificateConfirmationOpen(false);
        setCertificatePreviewUrl(null);
        setCertificatePreviewRows([]);
        notify("The original certificate details are unavailable, so it cannot be safely regenerated.", 10000);
        return;
      }
      const savedCertificate = parseClaimedCertificate(certificate);
      const pdfBytes = await buildCompletionCertificatePdf(
        savedCertificate.verificationCode,
        savedCertificate.issuedAt,
        savedCertificate.assessmentRows,
        false,
        savedCertificate.fullName,
      );
      downloadCompletionCertificate(pdfBytes, savedCertificate.verificationCode);
      setCertificateConfirmationOpen(false);
      setCertificatePreviewUrl(null);
      setCertificatePreviewRows([]);
      setCertificateClaimed(true);
      setClaimedCertificate(savedCertificate);
      setCompletionDialog("certificate");
    } catch (error) {
      console.error("Unable to generate completion certificate", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      notify(`Certificate could not be generated: ${errorMessage}`, 10000);
    } finally {
      setCertificateGenerating(false);
    }
  }

  async function persistPhaseQuestProgress(id: string, isCompleted: boolean, achievedAmount: number | null) {
    if (pendingPhaseQuestIds.includes(id)) return;
    const quest = phaseDailyQuests.find((item) => item.id === id);
    if (!quest) {
      notify("Challenge progress could not be saved: daily challenge was not found.");
      return;
    }

    setPendingPhaseQuestIds((ids) => [...ids, id]);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("save_phase_quest_progress", {
        p_quest_id: id,
        p_achieved_amount: achievedAmount,
        p_is_completed: isCompleted,
      });

      if (error) {
        notify(`Challenge progress could not be saved: ${error.message}`);
        return;
      }

      const savedProgress = Array.isArray(data) ? data[0] : data;
      const achievedAmountResult = Number(savedProgress?.achieved_amount);
      const earnedCoinResult = Number(savedProgress?.earned_coin);
      if (
        !savedProgress
        || savedProgress.quest_id !== id
        || !Number.isFinite(achievedAmountResult)
        || !Number.isInteger(earnedCoinResult)
        || typeof savedProgress.progress_updated !== "boolean"
        || (savedProgress.completed_at !== null && typeof savedProgress.completed_at !== "string")
      ) {
        notify("Challenge progress could not be saved: Supabase returned an invalid progress record.");
        return;
      }
      const normalizedProgress: PhaseQuestProgress = {
        quest_id: savedProgress.quest_id,
        achieved_amount: achievedAmountResult,
        earned_coin: earnedCoinResult,
        progress_updated: savedProgress.progress_updated,
        completed_at: savedProgress.completed_at,
      };

      const previousEarnedCoin = phaseQuestProgressById[id]?.earned_coin ?? 0;
      const coinDelta = normalizedProgress.earned_coin - previousEarnedCoin;
      setPhaseQuestProgressById((progress) => ({ ...progress, [id]: normalizedProgress }));
      setCompletedPhaseQuestIds((ids) => normalizedProgress.completed_at
        ? ids.includes(id) ? ids : [...ids, id]
        : ids.filter((questId) => questId !== id));
      setCoins((value) => Math.max(0, value + coinDelta));
      setDailyStardustByDay((days) => ({
        ...days,
        [quest.day_number]: Math.max(0, (days[String(quest.day_number)] ?? 0) + coinDelta),
      }));
      setChallengeCompletionDays((days) => {
        if (normalizedProgress.completed_at) return { ...days, [id]: quest.day_number };
        const nextDays = { ...days };
        delete nextDays[id];
        return nextDays;
      });
      setPhaseProgressDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[id];
        return nextDrafts;
      });
      notify(normalizedProgress.completed_at
        ? `Challenge saved. You earned ${normalizedProgress.earned_coin} coins.`
        : "Challenge progress saved.");
    } catch (error) {
      notify(`Challenge progress could not be saved: ${error instanceof Error ? error.message : "Unexpected error."}`);
    } finally {
      setPendingPhaseQuestIds((ids) => ids.filter((questId) => questId !== id));
    }
  }

  function savePhaseQuestProgress(id: string) {
    const draft = phaseProgressDrafts[id];
    if (draft === undefined || draft.trim() === "") return;
    const achievedAmount = Number(draft);
    if (!Number.isFinite(achievedAmount) || achievedAmount < 0) {
      notify("Enter a valid progress amount of zero or more.");
      return;
    }
    persistPhaseQuestProgress(id, false, achievedAmount);
  }

  async function saveUserQuestProgress(id: string) {
    const quest = userDailyQuests.find((item) => item.id === id);
    const draft = userQuestProgressDrafts[id];
    if (!quest || draft === undefined || draft.trim() === "") return;
    const achievedAmount = Number(draft);
    if (!Number.isFinite(achievedAmount) || achievedAmount < 0) {
      notify("Enter a valid progress amount of zero or more.");
      return;
    }
    if (pendingUserDailyQuestIds.includes(id)) return;

    setPendingUserDailyQuestIds((ids) => [...ids, id]);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_daily_quests")
        .update({ achieved_amount: achievedAmount })
        .eq("id", id)
        .eq("user_id", userId)
        .select("id, achieved_amount, is_completed, earned_coin")
        .single();

      if (error) {
        notify(`Your challenge progress could not be saved: ${error.message}`);
        return;
      }
      if (!data || data.id !== id) {
        notify("Your challenge progress could not be saved: Supabase returned an invalid record.");
        return;
      }

      const coinDelta = data.earned_coin - quest.earned_coin;
      setUserDailyQuests((items) => items.map((item) => item.id === id
        ? { ...item, achieved_amount: data.achieved_amount, is_completed: data.is_completed, earned_coin: data.earned_coin }
        : item));
      setCoins((value) => Math.max(0, value + coinDelta));
      if (coinDelta !== 0) {
        const earnedOnDay = challengeCompletionDays[id] ?? quest.start_date;
        setDailyStardustByDay((days) => ({
          ...days,
          [earnedOnDay]: Math.max(0, (days[String(earnedOnDay)] ?? 0) + coinDelta),
        }));
      }
      setUserQuestProgressDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[id];
        return nextDrafts;
      });
      notify("Challenge progress saved.");
    } catch (error) {
      notify(`Your challenge progress could not be saved: ${error instanceof Error ? error.message : "Unexpected error."}`);
    } finally {
      setPendingUserDailyQuestIds((ids) => ids.filter((questId) => questId !== id));
    }
  }

  async function toggleChallenge(id: string) {
    const target = activeChallenges.find((item) => item.id === id);
    if (!target) return;
    const done = !target.done;
    const userDailyQuest = userDailyQuests.find((quest) => quest.id === id);
    if (userDailyQuest) {
      if (pendingUserDailyQuestIds.includes(id)) return;
      setPendingUserDailyQuestIds((ids) => [...ids, id]);
      const draft = userQuestProgressDrafts[id];
      const draftedAmount = draft === undefined || draft.trim() === "" ? null : Number(draft);
      if (draftedAmount !== null && (!Number.isFinite(draftedAmount) || draftedAmount < 0)) {
        setPendingUserDailyQuestIds((ids) => ids.filter((questId) => questId !== id));
        notify("Enter a valid progress amount of zero or more.");
        return;
      }
      const achievedAmount = done
        ? draftedAmount ?? userDailyQuest.target_amount ?? userDailyQuest.achieved_amount
        : draftedAmount ?? 0;
      const earnedCoin = done
        ? userDailyQuest.total_coin + (
          userDailyQuest.target_amount !== null && achievedAmount >= userDailyQuest.target_amount ? 10 : 0
        )
        : 0;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("user_daily_quests")
          .update({ is_completed: done, achieved_amount: achievedAmount, earned_coin: earnedCoin })
          .eq("id", id)
          .eq("user_id", userId)
          .select("id, is_completed, achieved_amount, earned_coin")
          .single();

        if (error) {
          notify(`Your custom challenge could not be updated: ${error.message}`);
          return;
        }
        if (!data || data.id !== id) {
          notify("Your custom challenge could not be updated: Supabase returned an invalid record.");
          return;
        }

        const coinDelta = data.earned_coin - userDailyQuest.earned_coin;
        setUserDailyQuests((items) => items.map((item) => item.id === id
          ? { ...item, is_completed: data.is_completed, achieved_amount: data.achieved_amount, earned_coin: data.earned_coin }
          : item));
        setUserQuestProgressDrafts((drafts) => {
          const nextDrafts = { ...drafts };
          delete nextDrafts[id];
          return nextDrafts;
        });
        setCoins((value) => Math.max(0, value + coinDelta));
        const earnedOnDay = done ? selectedDay : challengeCompletionDays[id] ?? selectedDay;
        setDailyStardustByDay((days) => ({
          ...days,
          [earnedOnDay]: Math.max(0, (days[String(earnedOnDay)] ?? 0) + coinDelta),
        }));
        setChallengeCompletionDays((days) => {
          if (data.is_completed) return { ...days, [id]: earnedOnDay };
          const nextDays = { ...days };
          delete nextDays[id];
          return nextDays;
        });
        notify(done ? "Custom challenge completed." : "Custom challenge marked incomplete.");
      } catch (error) {
        notify(`Your custom challenge could not be updated: ${error instanceof Error ? error.message : "Unexpected error."}`);
      } finally {
        setPendingUserDailyQuestIds((ids) => ids.filter((questId) => questId !== id));
      }
      return;
    }

    if (target.phaseFocus) {
      const draft = phaseProgressDrafts[id];
      const achievedAmount = draft === undefined || draft.trim() === "" ? null : Number(draft);
      if (achievedAmount !== null && (!Number.isFinite(achievedAmount) || achievedAmount < 0)) {
        notify("Enter a valid progress amount of zero or more.");
        return;
      }
      await persistPhaseQuestProgress(id, done, achievedAmount);
      return;
    }

    setChallenges((items) => items.map((item) => item.id === id ? { ...item, done } : item));
    if (done) {
      setChallengeCompletionDays((days) => ({ ...days, [id]: selectedDay }));
      setDailyStardustByDay((days) => ({ ...days, [selectedDay]: (days[String(selectedDay)] ?? 0) + target.reward }));
    } else {
      const earnedOnDay = challengeCompletionDays[id] ?? selectedDay;
      setDailyStardustByDay((days) => ({ ...days, [earnedOnDay]: Math.max(0, (days[String(earnedOnDay)] ?? 0) - target.reward) }));
      setChallengeCompletionDays((days) => {
        const nextDays = { ...days };
        delete nextDays[id];
        return nextDays;
      });
    }
  }

  function openProgressEditor(challenge: Challenge) {
    const userDailyQuest = userDailyQuests.find((quest) => quest.id === challenge.id);
    const [scheduleText = ""] = challenge.detail.split(" · ");
    const schedule = scheduleText.toLowerCase();
    const frequency = challenge.frequency ?? Number(schedule.match(/^(\d+)\s*x/i)?.[1]);
    const targetMatch = challenge.detail.match(/0\s*\/\s*([\d.]+)\s+([^·]+)/i);
    const levelMatch = challenge.detail.match(/\b(Easy|Medium|Hard)\b/i)?.[1];
    const storedUnit = challenge.targetUnit ?? targetMatch?.[2].trim() ?? "pages";
    const knownUnits = ["pages", "km", "minutes", "reps", "glasses", "times"];
    const questSchedule = userDailyQuest?.frequency === "Daily"
      ? "daily"
      : userDailyQuest?.frequency === "Weekly"
        ? "weekly"
        : userDailyQuest
          ? "one-time"
          : schedule === "daily"
            ? "daily"
            : schedule === "one-time"
              ? "one-time"
              : schedule === "2x/week" || frequency === 2 || schedule === "3x/week" || frequency === 3
                ? "weekly"
                : "one-time";
    setProgressChallengeId(challenge.id);
    setProgressTitle(challenge.title);
    setProgressDescription(challenge.description ?? "");
    setProgressStartDay(userDailyQuest?.start_date ?? challenge.startDay ?? challenge.dayNumber ?? selectedDay);
    setProgressEndDay(userDailyQuest?.end_date ?? challenge.endDay ?? challenge.dayNumber ?? selectedDay);
    setProgressSchedule(questSchedule);
    setProgressLevel(challenge.level ?? (levelMatch === "Medium" || levelMatch === "Hard" ? levelMatch : "Easy"));
    setProgressTarget(String(challenge.targetAmount ?? targetMatch?.[1] ?? ""));
    setProgressUnit(knownUnits.includes(storedUnit) ? storedUnit : "custom");
    setProgressCustomUnit(knownUnits.includes(storedUnit) ? "" : storedUnit);
    setConfirmChallengeDelete(false);
  }

  async function updateChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const challenge = challenges.find((item) => item.id === progressChallengeId);
    const userDailyQuest = userDailyQuests.find((item) => item.id === progressChallengeId);
    if (!challenge && !userDailyQuest) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("task_name") ?? "").trim();
    const description = String(data.get("short_description") ?? "").trim();
    const startDay = Number(data.get("start_date") ?? progressStartDay);
    const endDay = Number(data.get("end_date") ?? progressEndDay);
    const schedule = String(data.get("frequency") ?? "one-time") as "one-time" | "daily" | "weekly";
    const rawTarget = String(data.get("target") ?? "").trim();
    const targetAmount = rawTarget ? Number(rawTarget) : null;
    const selectedUnit = String(data.get("unit") ?? "").trim();
    const targetUnit = selectedUnit === "custom" ? String(data.get("customUnit") ?? "").trim() : selectedUnit;
    const level = String(data.get("level") ?? "Easy") as "Easy" | "Medium" | "Hard";
    const multiplier = level === "Easy" ? 1 : level === "Medium" ? 2 : 3;
    if (
      !title
      || description.length > 300
      || !Number.isInteger(startDay)
      || !Number.isInteger(endDay)
      || startDay < 1
      || endDay > 40
      || endDay < startDay
      || (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount <= 0 || !targetUnit))
    ) {
      if (targetAmount !== null && selectedUnit === "custom" && !targetUnit) notify("Enter a custom target unit.");
      return;
    }
    const reward = multiplier * 10;
    const scheduleDetail = schedule;
    const unitLabel = targetUnit === "times" ? targetAmount === 1 ? "time" : "times" : targetUnit;
    const targetDetail = targetAmount === null ? "Target open" : `0 / ${targetAmount} ${unitLabel}`;
    const detail = `${scheduleDetail} · ${level} · ${targetDetail}`;
    if (userDailyQuest) {
      if (pendingUserDailyQuestIds.includes(userDailyQuest.id)) return;
      setPendingUserDailyQuestIds((ids) => [...ids, userDailyQuest.id]);
      const earnedCoin = userDailyQuest.is_completed ? reward : 0;
      try {
        const supabase = createClient();
        const { data: updatedQuest, error } = await supabase
          .from("user_daily_quests")
          .update({
            task_name: title,
            short_description: description,
            start_date: startDay,
            end_date: endDay,
            frequency: schedule === "one-time" ? "One-Time" : schedule === "daily" ? "Daily" : "Weekly",
            level,
            total_coin: reward,
            target_amount: targetAmount,
            target_unit: targetAmount === null ? null : targetUnit,
            achieved_amount: userDailyQuest.is_completed ? targetAmount ?? userDailyQuest.achieved_amount : userDailyQuest.achieved_amount,
            earned_coin: earnedCoin,
          })
          .eq("id", userDailyQuest.id)
          .eq("user_id", userId)
          .select("id, user_id, task_name, short_description, start_date, end_date, frequency, level, total_coin, target_amount, target_unit, achieved_amount, is_completed, earned_coin")
          .single();

        if (error) {
          notify(`Your custom challenge could not be updated: ${error.message}`);
          return;
        }
        if (!updatedQuest) {
          notify("Your custom challenge could not be updated: Supabase returned no record.");
          return;
        }

        const coinDelta = updatedQuest.earned_coin - userDailyQuest.earned_coin;
        setUserDailyQuests((items) => items.map((item) => item.id === updatedQuest.id ? updatedQuest : item));
        setCoins((value) => Math.max(0, value + coinDelta));
        if (userDailyQuest.is_completed) {
          setDailyStardustByDay((days) => {
            const previousCompletionDay = challengeCompletionDays[userDailyQuest.id] ?? userDailyQuest.start_date;
            const updatedCompletionDay = challengeCompletionDays[updatedQuest.id] ?? updatedQuest.start_date;
            if (previousCompletionDay === updatedCompletionDay) {
              return {
                ...days,
                [updatedCompletionDay]: Math.max(0, (days[String(updatedCompletionDay)] ?? 0) + coinDelta),
              };
            }
            return {
              ...days,
              [previousCompletionDay]: Math.max(0, (days[String(previousCompletionDay)] ?? 0) - userDailyQuest.earned_coin),
              [updatedCompletionDay]: Math.max(0, (days[String(updatedCompletionDay)] ?? 0) + updatedQuest.earned_coin),
            };
          });
          if (!challengeCompletionDays[updatedQuest.id]) {
            setChallengeCompletionDays((days) => ({ ...days, [updatedQuest.id]: updatedQuest.start_date }));
          }
        }
        setProgressChallengeId(null);
        notify("Custom challenge updated.");
      } catch (error) {
        notify(`Your custom challenge could not be updated: ${error instanceof Error ? error.message : "Unexpected error."}`);
      } finally {
        setPendingUserDailyQuestIds((ids) => ids.filter((id) => id !== userDailyQuest.id));
      }
      return;
    }

    if (!challenge) return;
    setChallenges((items) => items.map((item) => item.id === challenge.id ? {
      ...item,
      title,
      subtitle: description || detail,
      description,
      detail,
      reward,
      image: getTaskCover(title, gender),
      schedule,
      dayNumber: startDay,
      startDay,
      endDay,
      level,
      targetAmount: targetAmount ?? undefined,
      targetUnit: targetAmount === null ? undefined : targetUnit,
    } : item));
    if (challenge.done) {
      const earnedOnDay = challengeCompletionDays[challenge.id] ?? selectedDay;
      setDailyStardustByDay((days) => ({ ...days, [earnedOnDay]: Math.max(0, (days[String(earnedOnDay)] ?? 0) + reward - challenge.reward) }));
    }
    setProgressChallengeId(null);
    notify("Challenge progress updated.");
  }

  async function deleteProgressChallenge() {
    const challenge = challenges.find((item) => item.id === progressChallengeId);
    const userDailyQuest = userDailyQuests.find((item) => item.id === progressChallengeId);
    if (userDailyQuest) {
      if (pendingUserDailyQuestIds.includes(userDailyQuest.id)) return;
      setPendingUserDailyQuestIds((ids) => [...ids, userDailyQuest.id]);
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("user_daily_quests")
          .delete()
          .eq("id", userDailyQuest.id)
          .eq("user_id", userId);

        if (error) {
          notify(`Your custom challenge could not be deleted: ${error.message}`);
          return;
        }
        setUserDailyQuests((items) => items.filter((item) => item.id !== userDailyQuest.id));
        if (userDailyQuest.is_completed) {
          setCoins((value) => Math.max(0, value - userDailyQuest.earned_coin));
          const earnedOnDay = challengeCompletionDays[userDailyQuest.id] ?? userDailyQuest.start_date;
          setDailyStardustByDay((days) => ({
            ...days,
            [earnedOnDay]: Math.max(0, (days[String(earnedOnDay)] ?? 0) - userDailyQuest.earned_coin),
          }));
          setChallengeCompletionDays((days) => {
            const nextDays = { ...days };
            delete nextDays[userDailyQuest.id];
            return nextDays;
          });
        }
        setProgressChallengeId(null);
        setConfirmChallengeDelete(false);
        notify("Custom challenge removed.");
      } catch (error) {
        notify(`Your custom challenge could not be deleted: ${error instanceof Error ? error.message : "Unexpected error."}`);
      } finally {
        setPendingUserDailyQuestIds((ids) => ids.filter((id) => id !== userDailyQuest.id));
      }
      return;
    }
    if (!challenge) return;
    setChallenges((items) => items.filter((item) => item.id !== challenge.id));
    if (challenge.done) {
      const earnedOnDay = challengeCompletionDays[challenge.id] ?? selectedDay;
      setDailyStardustByDay((days) => ({ ...days, [earnedOnDay]: Math.max(0, (days[String(earnedOnDay)] ?? 0) - challenge.reward) }));
      setChallengeCompletionDays((days) => {
        const nextDays = { ...days };
        delete nextDays[challenge.id];
        return nextDays;
      });
    }
    setProgressChallengeId(null);
    setConfirmChallengeDelete(false);
    notify("Challenge removed.");
  }

  async function addChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("task_name") ?? "").trim();
    const description = String(data.get("short_description") ?? "").trim();
    const startDay = Number(data.get("start_date") ?? taskStartDay);
    const endDay = Number(data.get("end_date") ?? taskEndDay);
    const schedule = String(data.get("frequency") ?? "one-time") as "one-time" | "daily" | "weekly";
    const rawTarget = String(data.get("target") ?? "").trim();
    const targetAmount = rawTarget ? Number(rawTarget) : null;
    const selectedUnit = String(data.get("unit") ?? "").trim();
    const targetUnit = selectedUnit === "custom" ? String(data.get("customUnit") ?? "").trim() : selectedUnit;
    const level = String(data.get("level") ?? "Easy") as "Easy" | "Medium" | "Hard";
    if (
      !title
      || !description
      || description.length > 300
      || !Number.isInteger(startDay)
      || !Number.isInteger(endDay)
      || startDay < 1
      || endDay > 40
      || endDay < startDay
      || (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount <= 0 || !targetUnit))
    ) {
      if (targetAmount !== null && selectedUnit === "custom" && !targetUnit) {
        notify("Enter a custom target unit.");
      }
      return;
    }
    if (taskSaving) return;
    setTaskSaving(true);
    try {
      const supabase = createClient();
      const { data: createdQuest, error } = await supabase
        .from("user_daily_quests")
        .insert({
          user_id: userId,
          task_name: title,
          short_description: description,
          start_date: startDay,
          end_date: endDay,
          frequency: schedule === "one-time" ? "One-Time" : schedule === "daily" ? "Daily" : "Weekly",
          level,
          total_coin: taskReward,
          target_amount: targetAmount,
          target_unit: targetAmount === null ? null : targetUnit,
        })
        .select("id, user_id, task_name, short_description, start_date, end_date, frequency, level, total_coin, target_amount, target_unit, achieved_amount, is_completed, earned_coin")
        .single();

      if (error) {
        notify(`Your challenge could not be created: ${error.message}`);
        return;
      }
      if (!createdQuest) {
        notify("Your challenge could not be created: Supabase returned no record.");
        return;
      }

      setUserDailyQuests((quests) => [...quests, createdQuest]);
      setModalOpen(false);
      setTaskName("");
      setTaskDescription("");
      setTaskStartDay(selectedDay);
      setTaskEndDay(selectedDay);
      setTaskSchedule("one-time");
      setTaskLevel("Easy");
      setTaskTargetAmount("");
      setTaskUnit("pages");
      setCustomTaskUnit("");
      notify(`Challenge added for Day ${startDay}–${endDay}.`);
    } catch (error) {
      notify(`Your challenge could not be created: ${error instanceof Error ? error.message : "Unexpected error."}`);
    } finally {
      setTaskSaving(false);
    }
  }

  function selectGender(value: Gender) {
    setGender(value);
    notify(`Your journey is now personalized for ${value === "woman" ? "women" : "men"}.`);
  }

  function openTaskCreator() {
    setTaskSchedule("one-time");
    setTaskLevel("Easy");
    setTaskName("");
    setTaskDescription("");
    setTaskStartDay(selectedDay);
    setTaskEndDay(selectedDay);
    setTaskTargetAmount("");
    setTaskUnit("pages");
    setCustomTaskUnit("");
    setModalOpen(true);
  }

  function closeTaskCreator() {
    setModalOpen(false);
    setTaskSchedule("one-time");
    setTaskLevel("Easy");
    setTaskName("");
    setTaskDescription("");
    setTaskStartDay(selectedDay);
    setTaskEndDay(selectedDay);
    setTaskTargetAmount("");
    setTaskUnit("pages");
    setCustomTaskUnit("");
  }

  function jumpToChallenges() {
    document.getElementById("today")?.scrollIntoView({ behavior: "smooth" });
  }

  function openProfile() {
    setBonusOpen(false);
    setLeaderboardOpen(false);
    setProfileOpen(true);
  }

  async function resetJourney() {
    const supabase = createClient();
    const { error } = await supabase
      .from("user_phase_quest_progress")
      .delete()
      .eq("user_id", userId);

    if (error) {
      notify(`Your saved phase challenge progress could not be reset: ${error.message}`);
      return;
    }

    const { data: wallet, error: walletError } = await supabase
      .from("coin_wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (walletError) {
      notify(`Challenge progress was reset, but your coin balance could not be refreshed: ${walletError.message}`);
      return;
    }

    setChallenges(initialChallenges);
    setCompletedPhaseQuestIds([]);
    setSelectedDay(1);
    setDailyStardustByDay({});
    setChallengeCompletionDays({});
    setCoins(wallet.balance);
    setGender("woman");
    setProfileName(name);
    setProfileTheme("dark");
    setProfileDialog(null);
    ["joolo-gender", "joolo-challenges", "joolo-daily-stardust", "joolo-challenge-completion-days", "joolo-coins", "joolo-profile-name", "joolo-profile-theme"].forEach((key) => localStorage.removeItem(`${userId}:${key}`));
    notify("Your journey data has been reset.");
  }

  function openJourneyDatePicker() {
    setJourneyStartDateDraft(journeyStartDate);
    setJourneyDateError("");
    setJourneyDatePickerOpen(true);
  }

  async function saveJourneyStartDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!journeyStartDateDraft) return;

    setJourneyDateSaving(true);
    setJourneyDateError("");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("save_challenge_start_date", {
      p_start_date: journeyStartDateDraft,
    });

    setJourneyDateSaving(false);
    if (error) {
      setJourneyDateError(`Tanggal mulai gagal disimpan: ${error.message}`);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result !== "object" || !("start_date" in result) || typeof result.start_date !== "string") {
      setJourneyDateError("Tanggal mulai gagal disimpan: Supabase mengembalikan data yang tidak valid.");
      return;
    }

    setJourneyStartDate(result.start_date);
    setJourneyStartDateDraft(result.start_date);
    setJourneyDatePickerOpen(false);
    notify("Challenge start date saved to your account.");
  }

  async function logOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      notify(error.message);
      return;
    }
    setProfileDialog(null);
    setProfileOpen(false);
    router.replace("/login");
    router.refresh();
  }

  async function downloadBonus(resource: BonusResource, type: BonusType) {
    let content: Uint8Array;
    let mimeType: string;
    let extension: string;

    if (type === "ebook") {
      const document = await PDFDocument.create();
      const font = await document.embedFont(StandardFonts.Helvetica);
      const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
      const page = document.addPage([595, 842]);
      const navy = rgb(0.035, 0.065, 0.12);
      const cyan = rgb(0.36, 0.95, 0.89);
      page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: navy });
      page.drawText("JOOLO  /  COSMIC GROWTH", { x: 54, y: 780, size: 11, font: boldFont, color: cyan });
      page.drawText(resource.category.toUpperCase(), { x: 54, y: 704, size: 10, font: boldFont, color: rgb(0.75, 0.62, 0.91) });
      page.drawText(resource.title, { x: 54, y: 659, size: 29, font: boldFont, color: rgb(0.94, 0.96, 1), maxWidth: 485 });
      page.drawText("A small guide for your next chapter", { x: 54, y: 630, size: 12, font, color: rgb(0.65, 0.73, 0.84) });
      page.drawLine({ start: { x: 54, y: 606 }, end: { x: 541, y: 606 }, thickness: 1, color: rgb(0.21, 0.39, 0.49) });

      const sections = [
        ["A NOTE BEFORE YOU BEGIN", resource.description],
        ["START WHERE YOU ARE", "You do not need a perfect plan or a perfect day. Choose one small action that feels possible, and let it be enough for today."],
        ["MAKE IT EASY TO RETURN", "Connect your new practice to a moment that already exists in your day. Keep the first step short, make your tools easy to reach, and celebrate showing up."],
        ["YOUR NEXT SMALL STEP", "Write down one promise you want to keep this week. When a day does not go to plan, begin again with kindness. Progress is built by returning, not by being flawless."],
      ];
      let y = 563;
      for (const [heading, paragraph] of sections) {
        page.drawText(heading, { x: 54, y, size: 11, font: boldFont, color: cyan });
        y -= 22;
        const words = paragraph.split(/\s+/);
        let line = "";
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(candidate, 12) > 475 && line) {
            page.drawText(line, { x: 54, y, size: 12, font, color: rgb(0.79, 0.83, 0.89) });
            y -= 18;
            line = word;
          } else {
            line = candidate;
          }
        }
        if (line) {
          page.drawText(line, { x: 54, y, size: 12, font, color: rgb(0.79, 0.83, 0.89) });
          y -= 18;
        }
        y -= 28;
      }
      page.drawText("Small steps. Brighter orbits.", { x: 54, y: 55, size: 10, font: boldFont, color: cyan });
      content = await document.save();
      mimeType = "application/pdf";
      extension = "pdf";
    } else {
      const rows = [
        ...(resource.rows ?? [["Date", "Goal", "Progress", "Notes"]]),
        ...Array.from({ length: type === "tracker" && resource.title.includes("40-Day") ? 40 : 28 }, (_, index) => [
          resource.title.includes("40-Day") ? `Day ${index + 1}` : `Week ${Math.floor(index / 7) + 1} · Day ${(index % 7) + 1}`,
          "", "", "", "", "",
        ]),
      ];
      const cell = (value: string, column: number, row: number) => `<c r="${String.fromCharCode(65 + column)}${row + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
      const sheetRows = rows.map((row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => cell(value, columnIndex, rowIndex)).join("")}</row>`,
      ).join("");
      const workbookFiles = {
        "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
        "_rels/.rels": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
        "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(resource.title.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
        "xl/_rels/workbook.xml.rels": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
        "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`),
      };
      content = zipSync(workbookFiles);
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    }

    const url = URL.createObjectURL(new Blob([content.buffer as ArrayBuffer], { type: mimeType }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${resource.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${extension}`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`${resource.title} is ready to download.`);
  }

  if (!hydrated) {
    return (
      <main className="cosmos login-screen">
        <div className="stars stars-one" /><div className="stars stars-two" />
        <div className="nebula nebula-left" /><div className="nebula nebula-right" />
        <p className="login-loading" role="status">{t("Opening your orbit...")}</p>
      </main>
    );
  }

  return (
    <main className="cosmos">
      <div className="stars stars-one" /><div className="stars stars-two" />
      <div className="nebula nebula-left" /><div className="nebula nebula-right" />
      <header className="topbar shell">
        <a href="#top" className="brand" aria-label={t("JOolo home")}><span className="brand-mark">✦</span><span>JO<span className="brand-muted">O</span>LO<span className="brand-dot">.</span></span></a>
        <nav className="main-nav" aria-label={t("Main navigation")}>
          <button className="nav-link" onClick={() => setLeaderboardOpen(true)}>{t("Leaderboard")}</button>
          <a className={`nav-link ${bonusOpen ? "" : "active"}`} href="#calendar" onClick={() => setBonusOpen(false)}>{t("Challenge")}</a>
          <button className={`nav-link ${bonusOpen ? "active bonus-nav-active" : ""}`} onClick={() => { setBonusOpen(true); setBonusSearch(""); setBonusSearchOpen(false); }}>{t("Bonus")}</button>
        </nav>
        <div className="header-actions">
          {languageSelector}
          <button className="icon-button" onClick={openProfile} aria-label={t("Profile")}><Icon name="user" size={21} /></button>
          <a className="mobile-cta" href="#today">{t("Today")} <Icon name="arrow" size={16} /></a>
        </div>
      </header>

      <div className="shell page-content" id="top">
        <section className="hero-row" aria-label={t("Your journey overview")}>
          <div className="hero-intro">
            <div className="eyebrow"><span className="eyebrow-line" /> {t("YOUR NEXT CHAPTER STARTS HERE")}</div>
            <h1>{t("Become who")}<br /><span>{t("you came here to be.")}</span></h1>
            <p>{t("Forty days. A few small promises. A whole new orbit.")}</p>
            <a className="primary-button" href="#today">{t("Continue your journey")} <Icon name="arrow" size={17} /></a>
          </div>
          <div className="hero-overview">
            <div className="overview-cards">
              <div className="overview-card cue-card rank-card">
                <span className="card-kicker">{t("DAILY LEADERBOARD")}</span>
                <strong>#{dailyLeaderboardRank || "—"}</strong>
                <small>{t("YOUR RANK")}</small>
              </div>
              <div className="overview-card phase-card">
                <div className="phase-emblem"><Icon name="sparkles" size={35} /></div>
                <div><span className="card-kicker">{t("YOUR CURRENT PHASE")}</span><strong>{currentPhase?.phase_category_id.replace("PHASE_", language === "id" ? "Fase " : "Phase ") ?? t("Phase 01")} <span>·</span> {t(currentPhase?.phase_name ?? "Awakening")}</strong><small>{currentPhase?.focus ?? t("Every journey begins with a spark.")}</small></div>
                <span className="phase-index">{currentPhase?.phase_category_id.replace("PHASE_", "") ?? "01"}</span>
              </div>
              <div className="overview-card stat-card">
                <span className="stat-icon coin-icon">✦</span><strong>{coins}</strong><span className="stat-label">{t("TOTAL COIN")}</span>
              </div>
              <div className="overview-card lives-card">
                <div className="lives-heading"><span className="card-kicker">{t("TOTAL LIVES")}</span><strong>{lives}<small> / 7</small></strong></div>
                <div className="life-pips" aria-label={language === "id" ? `${lives} dari 7 nyawa tersisa` : `${lives} of 7 lives remaining`}>
                  {Array.from({ length: 7 }, (_, index) => <span className={index < lives ? "life-active" : ""} key={index}>♥</span>)}
                </div>
                <small className="lives-note">{t("No completed challenge in a day costs 1 life. At 0, 250 coins automatically restore 1 life; without enough coins, your challenge data resets.")}</small>
              </div>
            </div>
            <button className="overview-card start-card start-date-control" type="button" onClick={openJourneyDatePicker} aria-label={`${t("Change challenge start date, currently")} ${journeyStartDateLabel}`}>
              <span className="start-dot" />
              <span className="start-date-caption">{t("CHALLENGE START")}</span>
              <strong>{journeyStartDateLabel}</strong>
            </button>
          </div>
        </section>

        <section className="calendar-panel glass-panel" id="calendar">
          <div className="section-heading calendar-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> {t("THE 40-DAY CHALLENGE")}</div><h2>{t("Your map to ")}<span>{t("more you.")}</span></h2></div>
            <div className="phase-pill"><span className="phase-light" /> {selectedPhase?.phase_category_id.replace("PHASE_", language === "id" ? "FASE " : "PHASE ") ?? t("PHASE 01")} <b>{t(selectedPhase?.phase_name ?? "Awakening").toUpperCase()}</b></div>
          </div>
          <div className="calendar-grid" role="group" aria-label={t("Select a challenge day")}>
            {Array.from({ length: 40 }, (_, index) => {
              const day = index + 1;
              const isCurrent = day === selectedDay;
              const isPast = day < selectedDay;
              return <button key={day} className={`day-cell ${isCurrent ? "current" : ""} ${isPast ? "past" : ""}`} onClick={() => setSelectedDay(day)} aria-label={`${t("Day ")}${day}${isCurrent ? t(", selected") : ""}`} aria-pressed={isCurrent}>
                <span>{String(day).padStart(2, "0")}</span><i className={isPast ? "complete-dot" : ""} />
              </button>;
            })}
          </div>
          <div className="calendar-footer"><span><span className="legend-dot current-dot" /> {t("TODAY")}</span><span><span className="legend-dot complete-dot" /> {t("COMPLETE")}</span><span className="calendar-note">{t("One day at a time. You’re right on track.")}</span></div>
        </section>

        <section className="daily-section" id="today">
          <div className="daily-heading">
            <div className="day-title-wrap"><div className="day-label">{t("YOUR DAILY CHALLENGE")}</div><h2>{t("DAY ")}<span>{String(dayNumber).padStart(2, "0")}</span></h2><p className="daily-quote">{selectedPhase?.focus ?? t("Focus information is not available for this day.")}</p></div>
            <div className="daily-controls">
              <div className="progress-chip"><span className="progress-ring">{progress}<small>%</small></span><span><b>{completed} {language === "id" ? "DARI" : "OF"} {activeChallenges.length}</b><small>{t("CHALLENGES DONE")}</small></span></div>
              <button className="add-button" onClick={openTaskCreator} aria-label={t("Add a challenge")}><Icon name="plus" size={23} /><span>{t("Add challenge")}</span></button>
            </div>
          </div>
          <div className="challenge-list">
            {activeChallenges.map((challenge, index) => {
              const image = challenge.custom || challenge.phaseFocus ? challenge.image : index < 2 ? challengeImages[gender][index === 0 ? "run" : "read"] : "";
              const coverImage = challenge.image || image;
              const phaseProgress = phaseQuestProgressById[challenge.id];
              const userQuest = userDailyQuests.find((quest) => quest.id === challenge.id);
              const progressDraft = phaseProgressDrafts[challenge.id];
              const userProgressDraft = userQuestProgressDrafts[challenge.id];
              const hasProgressDraft = progressDraft !== undefined;
              const draftedAmount = progressDraft === undefined ? 0 : Number(progressDraft);
              const validProgressDraft = progressDraft !== undefined
                && progressDraft.trim() !== ""
                && Number.isFinite(draftedAmount)
                && draftedAmount >= 0;
              const displayedReward = challenge.phaseFocus
                ? challenge.done
                  ? phaseProgress?.earned_coin ?? challenge.reward
                  : `${challenge.reward}-${challenge.reward + 10}`
                : userQuest?.is_completed
                  ? userQuest.earned_coin
                  : challenge.reward;
              return <article className={`challenge-card ${challenge.accent} ${challenge.done ? "is-done" : ""} ${challenge.custom ? "custom-card" : ""} ${challenge.phaseFocus ? "phase-quest-card" : ""}`} key={challenge.id} style={coverImage ? { backgroundImage: `linear-gradient(90deg, rgba(8, 17, 31, .98) 0%, rgba(8, 17, 31, .91) 38%, rgba(8, 17, 31, .31) 100%), url("${coverImage}")` } : undefined}>
                {userQuest && <button className="user-quest-edit" type="button" onClick={() => openProgressEditor(challenge)} disabled={pendingUserDailyQuestIds.includes(userQuest.id)}><Icon name="sparkles" size={15} /> {t("Edit challenge")}</button>}
                <div className="card-corner" />
                <div className="reward-tag"><span>✦</span> {displayedReward} <small>{t(challenge.phaseFocus ? "COIN" : "XP")}</small></div>
                <div className="challenge-content"><span className="challenge-category">{challenge.phaseFocus ?? (challenge.custom ? t("YOUR CHALLENGE") : t(index === 0 ? "BODY · MOVEMENT" : index === 1 ? "MIND · LEARNING" : "SOUL · REFLECTION"))}</span><h3>{challenge.title}</h3><p className="challenge-subtitle">{challenge.subtitle}</p><div className="challenge-detail"><span>{challenge.detail.split(" · ")[0]}</span><i /> <span>{challenge.detail.split(" · ")[1]}</span><i /> <span>{challenge.done ? t("Complete ✓") : challenge.detail.split(" · ")[2]}</span></div></div>
                {challenge.phaseFocus && <div className="phase-progress-editor">
                  <label htmlFor={`phase-progress-${challenge.id}`}>{t("Your progress")} <span>{formatProgressAmount(validProgressDraft ? draftedAmount : phaseProgress?.achieved_amount ?? 0)} / {challenge.phaseTarget}</span></label>
                  <div className="phase-progress-controls">
                    <input
                      id={`phase-progress-${challenge.id}`}
                      type="number"
                      min="0"
                      step="any"
                      value={progressDraft ?? String(phaseProgress?.achieved_amount ?? 0)}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setPhaseProgressDrafts((drafts) => ({ ...drafts, [challenge.id]: value }));
                      }}
                      disabled={pendingPhaseQuestIds.includes(challenge.id)}
                      aria-label={`${t("Progress amount for ")}${challenge.title}`}
                    />
                    <span>/ {challenge.phaseTarget}</span>
                    <button
                      type="button"
                      onClick={() => savePhaseQuestProgress(challenge.id)}
                      disabled={!hasProgressDraft || !validProgressDraft || pendingPhaseQuestIds.includes(challenge.id)}
                    >
                      {t("Save progress")}
                    </button>
                  </div>
                  <small>{t("Save your achievement here, then complete the challenge to receive coins. Reaching the target adds +10 bonus coins; completing without saved progress counts as reaching it.")}</small>
                </div>}
                {userQuest?.target_amount !== null && userQuest && <div className="phase-progress-editor">
                  <label htmlFor={`user-quest-progress-${challenge.id}`}>{t("Your progress")} <span>{formatProgressAmount(userQuestProgressDrafts[challenge.id] !== undefined && userQuestProgressDrafts[challenge.id].trim() !== "" ? Number(userQuestProgressDrafts[challenge.id]) : userQuest.achieved_amount)} / {formatProgressAmount(userQuest.target_amount)} {userQuest.target_unit}</span></label>
                  <div className="phase-progress-controls">
                    <input
                      id={`user-quest-progress-${challenge.id}`}
                      type="number"
                      min="0"
                      step="any"
                      value={userProgressDraft ?? String(userQuest.achieved_amount)}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setUserQuestProgressDrafts((drafts) => ({ ...drafts, [challenge.id]: value }));
                      }}
                      disabled={pendingUserDailyQuestIds.includes(challenge.id)}
                      aria-label={`${t("Progress amount for ")}${challenge.title}`}
                    />
                    <span>/ {formatProgressAmount(userQuest.target_amount)} {userQuest.target_unit}</span>
                    <button type="button" onClick={() => saveUserQuestProgress(challenge.id)} disabled={userProgressDraft === undefined || userProgressDraft.trim() === "" || pendingUserDailyQuestIds.includes(challenge.id)}>{t("Save progress")}</button>
                  </div>
                  <small>{t("Reach the target for +10 bonus coins when you complete this challenge.")}</small>
                </div>}
                <button className="complete-button" onClick={() => toggleChallenge(challenge.id)} disabled={pendingPhaseQuestIds.includes(challenge.id) || pendingUserDailyQuestIds.includes(challenge.id)} aria-label={`${t(challenge.done ? "Mark incomplete" : "Complete")} ${challenge.title}`} aria-pressed={challenge.done}><Icon name="check" size={22} /><span>{pendingPhaseQuestIds.includes(challenge.id) || pendingUserDailyQuestIds.includes(challenge.id) ? t("Saving...") : challenge.done ? t("Completed") : t("Complete challenge")}</span></button>
                <div className="card-progress"><span style={{ width: challenge.done ? "100%" : "18%" }} /></div>
              </article>;
            })}
          </div>
          {dayNumber === 40 && <div className={`day-40-actions ${canClaimCertificate ? "unlocked" : "locked"}`} aria-label={t("40-day challenge completion")}>
            {!canClaimCertificate && <p className="day-40-lock-note">{t("Complete at least one challenge on each of the 40 days to unlock these actions.")}</p>}
            <button className={`day-40-action-button certificate-action ${certificateClaimed ? "claimed" : ""}`} type="button" disabled={!canClaimCertificate || !certificateStatusLoaded || certificateGenerating || (certificateClaimed && !claimedCertificate)} title={t(canClaimCertificate ? "Claim your completion certificate" : "Complete all challenges to unlock")} onClick={() => { void openCertificateConfirmation(); }}>
              <Icon name="certificate" size={19} /> {t(certificateGenerating ? "Generating certificate..." : certificateClaimed ? claimedCertificate ? "Download certificate again" : "Certificate already claimed" : "Claim Certificate")} <Icon name="arrow" size={17} />
            </button>
          </div>}
        </section>

        <footer className="footer"><a href="#top" className="footer-brand">✦ JOolo<span>.</span></a><span>{t("Made for your becoming")} <i>✧</i> 2026</span><a href="#top">{t("Back to the stars ↑")}</a></footer>
      </div>

      {modalOpen && <div className="create-task-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTaskCreator(); }}>
        <section className="create-task-screen" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
          <header className="create-task-heading"><button className="create-task-back" type="button" onClick={closeTaskCreator} aria-label={t("Back to challenge")}><Icon name="back" size={23} /></button><h2 id="create-task-title">{t("Create Task")}</h2><span /></header>
          <form className="create-task-form" onSubmit={addChallenge}>
            <label className="task-field-label" htmlFor="challenge-title">{t("Task name")}</label>
            <input className="task-title-input" id="challenge-title" name="task_name" value={taskName} onChange={(event) => setTaskName(event.currentTarget.value)} placeholder={t("e.g. Run 5 km, read 10 pages...")} maxLength={60} required autoFocus />
            <label className="task-field-label" htmlFor="challenge-description">{t("Short description")}</label>
            <textarea className="task-title-input" id="challenge-description" name="short_description" value={taskDescription} onChange={(event) => setTaskDescription(event.currentTarget.value)} placeholder={t("What do you want to achieve?")} maxLength={300} rows={3} required />
            <div className="task-field-grid">
              <label className="task-field schedule-field">
                <span className="task-field-label">{t("Start date")}</span>
                <select name="start_date" value={taskStartDay} onChange={(event) => {
                  const day = Number(event.currentTarget.value);
                  setTaskStartDay(day);
                  if (taskEndDay < day) setTaskEndDay(day);
                }} aria-label={t("Start date")}>
                  {Array.from({ length: 40 }, (_, index) => <option key={index + 1} value={index + 1}>{t("Day ")}{String(index + 1).padStart(2, "0")}{index + 1 === selectedDay ? t(" · selected") : ""}</option>)}
                </select>
              </label>
              <label className="task-field schedule-field">
                <span className="task-field-label">{t("End date")}</span>
                <select name="end_date" value={taskEndDay} onChange={(event) => setTaskEndDay(Number(event.currentTarget.value))} aria-label={t("End date")}>
                  {Array.from({ length: 40 }, (_, index) => index + 1).filter((day) => day >= taskStartDay).map((day) => <option key={day} value={day}>{t("Day ")}{String(day).padStart(2, "0")}</option>)}
                </select>
              </label>
            </div>
            <label className="task-field schedule-field">
              <span className="task-field-label">{t("Frequency")}</span>
              <select name="frequency" value={taskSchedule} onChange={(event) => setTaskSchedule(event.currentTarget.value as "one-time" | "daily" | "weekly")} aria-label={t("Frequency")}>
                <option value="one-time">{t("One-Time")}</option>
                <option value="daily">{t("Daily")}</option>
                <option value="weekly">{t("Weekly")}</option>
              </select>
            </label>
            <div className="task-field-grid">
              <label className="task-field"><span className="task-field-label">{t("Level")}</span><select name="level" value={taskLevel} onChange={(event) => setTaskLevel(event.currentTarget.value as "Easy" | "Medium" | "Hard")}><option value="Easy">{t("Easy")}</option><option value="Medium">{t("Medium")}</option><option value="Hard">{t("Hard")}</option></select></label>
              <label className="task-field"><span className="task-field-label">{t("Total coin")}</span><div className="task-reward-preview"><span>✦</span><output aria-live="polite">{taskReward.toLocaleString()} {t("coin")}</output></div><small className="task-reward-hint">{t("Set automatically from the selected level")}</small></label>
            </div>
            <fieldset className="task-fieldset target-fieldset">
              <legend className="task-field-label">{t("Target (optional)")}</legend>
              <div className="target-inputs"><input aria-label={t("Target amount")} name="target" type="number" min="0.1" step="any" placeholder={t("Amount...")} value={taskTargetAmount} onChange={(event) => setTaskTargetAmount(event.currentTarget.value)} /><span className="target-divider">/</span><select name="unit" aria-label={t("Target unit")} value={taskUnit} onChange={(event) => setTaskUnit(event.currentTarget.value)}><option value="pages">{t("pages")}</option><option value="km">km</option><option value="minutes">{t("minutes")}</option><option value="reps">{t("reps")}</option><option value="glasses">{t("glasses")}</option><option value="times">{t("times")}</option><option value="custom">{t("Custom / Manual")}</option></select></div>
              {taskUnit === "custom" && <input className="custom-target-unit" aria-label={t("Custom target unit")} name="customUnit" value={customTaskUnit} onChange={(event) => setCustomTaskUnit(event.currentTarget.value)} placeholder={t("Enter your unit (e.g. chapters)")} maxLength={24} required={Boolean(taskTargetAmount.trim())} />}
              <small className="task-target-hint">{t("Complete with the target achieved for +10 bonus coins. Without a target, completion awards the level coin only.")}</small>
            </fieldset>
            <button className="create-task-submit" type="submit" disabled={taskSaving}>{taskSaving ? t("Saving challenge...") : t("Save challenge")} <Icon name="arrow" size={20} /></button>
          </form>
        </section>
      </div>}

      {progressChallengeId && <div className="progress-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProgressChallengeId(null); }}>
        <section className="progress-editor-screen" role="dialog" aria-modal="true" aria-labelledby="progress-editor-title">
          <header className="progress-editor-heading">
            <button className="progress-editor-back" type="button" onClick={() => setProgressChallengeId(null)} aria-label={t("Back to challenges")}><Icon name="back" size={23} /></button>
            <h2 id="progress-editor-title">{t(userDailyQuests.some((quest) => quest.id === progressChallengeId) ? "Edit challenge" : "Progress")}</h2>
            {userDailyQuests.some((quest) => quest.id === progressChallengeId) && <button className="progress-editor-delete" type="button" onClick={() => setConfirmChallengeDelete(true)} aria-label={t("Delete challenge")}><Icon name="trash" size={22} /></button>}
          </header>
          <form className="progress-editor-form" onSubmit={updateChallenge}>
            <label className="progress-editor-label" htmlFor="progress-task-name">{t("Task name")}</label>
            <input className="progress-editor-input progress-title-input" id="progress-task-name" name="task_name" value={progressTitle} onChange={(event) => setProgressTitle(event.currentTarget.value)} maxLength={60} required />
            <label className="progress-editor-label" htmlFor="progress-task-description">{t("Description")}</label>
            <textarea className="progress-editor-input" id="progress-task-description" name="short_description" value={progressDescription} onChange={(event) => setProgressDescription(event.currentTarget.value)} maxLength={300} rows={3} />
            <div className="task-field-grid">
              <label className="progress-editor-field">
                <span className="progress-editor-label">{t("Start date")}</span>
                <select name="start_date" value={progressStartDay} onChange={(event) => {
                  const day = Number(event.currentTarget.value);
                  setProgressStartDay(day);
                  if (progressEndDay < day) setProgressEndDay(day);
                }}>
                  {Array.from({ length: 40 }, (_, index) => <option key={index + 1} value={index + 1}>{t("Day ")}{String(index + 1).padStart(2, "0")}</option>)}
                </select>
              </label>
              <label className="progress-editor-field">
                <span className="progress-editor-label">{t("End date")}</span>
                <select name="end_date" value={progressEndDay} onChange={(event) => setProgressEndDay(Number(event.currentTarget.value))}>
                  {Array.from({ length: 40 }, (_, index) => index + 1).filter((day) => day >= progressStartDay).map((day) => <option key={day} value={day}>{t("Day ")}{String(day).padStart(2, "0")}</option>)}
                </select>
              </label>
            </div>
            <label className="progress-editor-field">
              <span className="progress-editor-label">{t("Frequency")}</span>
              <select name="frequency" value={progressSchedule} onChange={(event) => setProgressSchedule(event.currentTarget.value as "one-time" | "daily" | "weekly")}>
                <option value="one-time">{t("One-Time")}</option>
                <option value="daily">{t("Daily")}</option>
                <option value="weekly">{t("Weekly")}</option>
              </select>
            </label>
            <label className="progress-editor-field">
              <span className="progress-editor-label">{t("Level")}</span>
              <select name="level" value={progressLevel} onChange={(event) => setProgressLevel(event.currentTarget.value as "Easy" | "Medium" | "Hard")}>
                <option value="Easy">{t("Easy")}</option>
                <option value="Medium">{t("Medium")}</option>
                <option value="Hard">{t("Hard")}</option>
              </select>
            </label>
            <label className="progress-editor-field">
              <span className="progress-editor-label">{t("Total coin")}</span>
              <div className="task-reward-preview"><span>✦</span><output>{progressLevel === "Easy" ? 10 : progressLevel === "Medium" ? 20 : 30} {t("coin")}</output></div>
              <small className="task-reward-hint">{t("Automatically set by level; target achievement adds +10 on completion.")}</small>
            </label>
            <fieldset className="progress-editor-target">
              <legend className="progress-editor-label">{t("Achievement")}</legend>
              <div className="progress-editor-target-row">
                <input aria-label={t("Achievement amount")} name="target" type="number" min="0.1" step="any" placeholder={t("Amount...")} value={progressTarget} onChange={(event) => setProgressTarget(event.currentTarget.value)} />
                <span className="progress-editor-divider">/</span>
                <select name="unit" aria-label={t("Achievement unit")} value={progressUnit} onChange={(event) => setProgressUnit(event.currentTarget.value)}>
                  <option value="pages">{t("Pages")}</option>
                  <option value="km">KM</option>
                  <option value="minutes">{t("Minutes")}</option>
                  <option value="reps">{t("Reps")}</option>
                  <option value="glasses">{t("Glasses")}</option>
                  <option value="times">{t("Times")}</option>
                  <option value="custom">{t("Custom")}</option>
                </select>
              </div>
              {progressUnit === "custom" && <input className="progress-editor-custom-unit" aria-label={t("Custom achievement unit")} name="customUnit" value={progressCustomUnit} onChange={(event) => setProgressCustomUnit(event.currentTarget.value)} placeholder={t("Enter custom unit")} maxLength={24} required={Boolean(progressTarget.trim())} />}
              <small>{t("Enter a target amount and unit for this challenge.")}</small>
            </fieldset>
            <button className="progress-editor-update" type="submit">{t("Update")} <Icon name="check" size={19} /></button>
          </form>
          {confirmChallengeDelete && <div className="progress-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmChallengeDelete(false); }}>
            <section className="progress-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-challenge-title">
              <div className="progress-delete-icon"><Icon name="trash" size={22} /></div>
              <h3 id="delete-challenge-title">{t("Delete this challenge?")}</h3>
              <p>{t("This removes the challenge and its progress from your journey.")}</p>
              <div className="progress-delete-actions">
                <button type="button" onClick={() => setConfirmChallengeDelete(false)}>{t("Keep challenge")}</button>
                <button type="button" onClick={deleteProgressChallenge}>{t("Delete challenge")}</button>
              </div>
            </section>
          </div>}
        </section>
      </div>}

      {profileOpen && <div className={`profile-screen ${profileTheme === "light" ? "profile-light" : ""}`}>
        <div className="stars stars-one" /><div className="stars stars-two" />
        <section className="profile-content shell" aria-labelledby="profile-title">
          <header className="profile-heading">
            <button className="profile-back" onClick={() => setProfileOpen(false)} aria-label={t("Back to journey")}><Icon name="back" size={23} /></button>
            <h1 id="profile-title">{t("Profile")}</h1>
            <span className="profile-heading-spacer" />
          </header>
          <section className="profile-identity profile-panel">
            <div className="profile-avatar-frame"><img src={avatarUrl || (gender === "woman" ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=360&h=360&q=85" : "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=360&h=360&q=85")} alt={t("Profile avatar")} /></div>
            <div className="profile-identity-copy"><span className="profile-kicker">{t("YOUR COSMIC JOURNEY")}</span><h2>{profileName}</h2><span className="profile-handle">{email}</span><button className="profile-edit-button" onClick={() => setProfileDialog("edit")}>{t("Edit profile")} <Icon name="chevron" size={14} /></button></div>
            <div className="profile-stats">
              <div><Icon name="sparkles" size={18} /><span>{t("PHASE 1")}</span></div>
              <div><Icon name="trophy" size={18} /><span>{completed} <small>{t("challenges")}</small></span></div>
              <div><span className="profile-coin">✦</span><span>{coins} <small>{t("coin")}</small></span></div>
            </div>
          </section>
          <section className="profile-panel profile-preferences">
            <span className="profile-section-label">{t("PREFERENCES")}</span>
            <div className="profile-preference-row"><span className="profile-row-icon"><Icon name="settings" size={24} /></span><strong>{t("Appearance")}</strong><div className="appearance-switch" role="group" aria-label={t("Appearance theme")}><button className={profileTheme === "dark" ? "selected" : ""} aria-pressed={profileTheme === "dark"} onClick={() => setProfileTheme("dark")}><Icon name="moon" size={17} /> {t("Dark")}</button><button className={profileTheme === "light" ? "selected" : ""} aria-pressed={profileTheme === "light"} onClick={() => setProfileTheme("light")}><Icon name="sun" size={17} /> {t("Light")}</button></div></div>
          </section>
          <section className="profile-panel">
            <span className="profile-section-label">{t("ACHIEVEMENTS")}</span>
            <button className="profile-action-row certificate-row" disabled={!canClaimCertificate || !certificateStatusLoaded || certificateGenerating || (certificateClaimed && !claimedCertificate)} onClick={() => { void openCertificateConfirmation(); }}><span className="profile-row-icon"><Icon name="certificate" size={25} /></span><strong>{t(certificateGenerating ? "Generating certificate..." : certificateClaimed ? claimedCertificate ? "Download certificate again" : "Certificate already claimed" : "Claim Certificate")}</strong><span className="certificate-progress">{t(certificateClaimed ? "CLAIMED" : canClaimCertificate ? "COMPLETE 40 DAYS" : "AVAILABLE ON DAY 40")}</span><Icon name="chevron" size={21} /></button>
          </section>
          <section className="profile-panel profile-data-panel">
            <span className="profile-section-label">{t("DATA")}</span>
            <button className="profile-action-row reset-row" onClick={() => setProfileDialog("reset")}><span className="profile-row-icon"><Icon name="trash" size={23} /></span><span className="profile-action-copy"><strong>{t("Reset Data")}</strong><small>{t("Clear your progress and start again from day one.")}</small></span><Icon name="chevron" size={21} /></button>
          </section>
          <section className="profile-panel">
            <span className="profile-section-label">{t("APP GUIDE")}</span>
            <button className={`profile-action-row guide-row ${expandedGuide === "how" ? "expanded" : ""}`} onClick={() => setExpandedGuide((value) => value === "how" ? null : "how")}><span className="profile-row-icon"><Icon name="book" size={24} /></span><strong>{t("How to Use")}</strong><Icon name="chevron" size={21} /></button>
            {expandedGuide === "how" && <p className="profile-guide-copy">{t("Choose a day on your 40-day map, complete a small daily challenge, and collect coins as you build consistency. Your progress is saved on this device.")}</p>}
            <button className={`profile-action-row guide-row ${expandedGuide === "points" ? "expanded" : ""}`} onClick={() => setExpandedGuide((value) => value === "points" ? null : "points")}><span className="profile-row-icon"><Icon name="star" size={24} /></span><strong>{t("Points Explained")}</strong><Icon name="chevron" size={21} /></button>
            {expandedGuide === "points" && <p className="profile-guide-copy">{t("Each completed challenge earns the coins shown on its card. Your balance appears here and on your journey dashboard.")}</p>}
          </section>
          <section className="profile-panel">
            <span className="profile-section-label">{t("SUPPORT")}</span>
            <a className="profile-action-row guide-row" href="mailto:hello@joolo.app?subject=JOolo%20support"><span className="profile-row-icon"><Icon name="support" size={24} /></span><strong>{t("Customer Service")}</strong><Icon name="chevron" size={21} /></a>
            <button className="profile-action-row guide-row" onClick={() => setProfileDialog("feedback")}><span className="profile-row-icon"><Icon name="message" size={24} /></span><strong>{t("Feedback")}</strong><Icon name="chevron" size={21} /></button>
          </section>
          <button className="profile-logout" onClick={() => setProfileDialog("logout")}><Icon name="logout" size={17} /> {t("Log Out")}</button>
          <footer className="profile-version">JOOLO <span>v1.0.0</span><i>✦</i></footer>
        </section>
        {profileDialog && <div className="modal-backdrop profile-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileDialog(null); }}>
          <section className="modal glass-panel profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title">
            <button className="modal-close" onClick={() => setProfileDialog(null)} aria-label={t("Close")}><Icon name="close" size={19} /></button>
            <div className="modal-icon"><Icon name={profileDialog === "reset" ? "trash" : profileDialog === "certificate" ? "certificate" : profileDialog === "logout" ? "logout" : profileDialog === "feedback" ? "message" : "sparkles"} size={25} /></div>
            {profileDialog === "edit" && <><span className="eyebrow">{t("MAKE IT YOURS")}</span><h2 id="profile-dialog-title">{t("Edit your profile.")}</h2><p>{t("Choose the name you want to see on your journey.")}</p><form onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("name") ?? "").trim(); if (value) setProfileName(value); setProfileDialog(null); notify("Profile updated."); }}><label htmlFor="profile-name">{t("Display name")}</label><input id="profile-name" name="name" defaultValue={profileName} maxLength={32} required /><button className="primary-button submit-button" type="submit">{t("Save profile")} <Icon name="check" size={16} /></button></form></>}
            {profileDialog === "reset" && <><span className="eyebrow">{t("A FRESH ORBIT")}</span><h2 id="profile-dialog-title">{t("Reset your journey?")}</h2><p>{t("This clears your saved challenges, coins, and preferences on this device. This can’t be undone.")}</p><div className="profile-dialog-actions"><button className="outline-button" onClick={() => setProfileDialog(null)}>{t("Keep my progress")}</button><button className="profile-danger-button" onClick={resetJourney}>{t("Reset everything")}</button></div></>}
            {profileDialog === "certificate" && <><span className="eyebrow">{t("YOUR NEXT MILESTONE")}</span><h2 id="profile-dialog-title">{t("Your 40-day orbit awaits.")}</h2><p>{t("Reach Day 40 and complete all your daily challenges to unlock your certificate.")}</p><button className="primary-button submit-button" onClick={() => { setProfileDialog(null); setProfileOpen(false); setSelectedDay(40); document.getElementById("calendar")?.scrollIntoView({ behavior: "smooth" }); }}>{t("Go to day 40")} <Icon name="arrow" size={16} /></button></>}
            {profileDialog === "feedback" && <><span className="eyebrow">{t("HELP US GROW")}</span><h2 id="profile-dialog-title">{t("Send a little feedback.")}</h2><p>{t("What could make your next orbit even better?")}</p><form onSubmit={(event) => { event.preventDefault(); setProfileDialog(null); notify("Thanks for helping JOolo grow!"); }}><label htmlFor="feedback-message">{t("Your feedback")}</label><textarea id="feedback-message" name="feedback" rows={4} maxLength={500} placeholder={t("Share an idea or tell us how it’s going...")} required /><button className="primary-button submit-button" type="submit">{t("Send feedback")} <Icon name="arrow" size={16} /></button></form></>}
            {profileDialog === "logout" && <><span className="eyebrow">{t("YOUR ACCOUNT")}</span><h2 id="profile-dialog-title">{t("Ready to head out?")}</h2><p>{t("You’ll be securely signed out. Your journey progress will stay saved on this device.")}</p><button className="primary-button submit-button" onClick={logOut}>{t("Log out")} <Icon name="logout" size={16} /></button></>}
          </section>
        </div>}
      </div>}

      {certificateConfirmationOpen && <div className="modal-backdrop certificate-confirmation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCertificateConfirmation(); }}>
        <section className="modal glass-panel certificate-confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="certificate-confirmation-title" aria-describedby="certificate-confirmation-message">
          <button className="modal-close" type="button" onClick={closeCertificateConfirmation} disabled={certificateGenerating} aria-label={t("Close")}><Icon name="close" size={19} /></button>
          <div className="certificate-confirmation-copy">
            <div className="modal-icon"><Icon name="certificate" size={25} /></div>
            <span className="eyebrow">{t("Claim certificate")}</span>
            <h2 id="certificate-confirmation-title">{t("Review your certificate")}</h2>
            <p id="certificate-confirmation-message">{t("This certificate can only be claimed once. Before you confirm, check that your full name and all scores are correct.")}</p>
            <div className="certificate-review-name">
              <span>{t("Full name on certificate")}</span>
              <strong>{profileName.trim() || email || "JOolo member"}</strong>
              <button type="button" onClick={() => {
                closeCertificateConfirmation();
                setProfileOpen(true);
                setProfileDialog("edit");
              }} disabled={certificateGenerating}>{t("Edit full name")}</button>
            </div>
            <div className="certificate-review-scores">
              <h3>{t("Your soft-skill scores")}</h3>
              <div className="certificate-review-table-wrap">
                <table>
                  <thead><tr><th>{t("Soft skills")}</th><th>{t("Earned coin")}</th><th>{t("Max coin")}</th><th>{t("Percentage")}</th></tr></thead>
                  <tbody>{certificatePreviewRows.map(({ skillCategoryId, assessment }) => (
                    <tr key={skillCategoryId}>
                      <th scope="row">{assessment.softSkills}</th>
                      <td>{assessment.earnedCoin.toLocaleString("id-ID")}</td>
                      <td>{assessment.maxPossibleCoin.toLocaleString("id-ID")}</td>
                      <td>{assessment.maxPossibleCoin > 0
                        ? `${((assessment.earnedCoin / assessment.maxPossibleCoin) * 100).toFixed(1)}%`
                        : "0.0%"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            <p className="certificate-preview-note">{t("The preview shows the name and scores that will be issued. The final download will include its official issue date and certificate ID.")}</p>
            <div className="certificate-confirmation-actions">
              <button className="outline-button" type="button" onClick={closeCertificateConfirmation} disabled={certificateGenerating}>{t("Cancel claim")}</button>
              <button className="primary-button" type="button" onClick={() => { void claimCompletionCertificate(); }} disabled={certificateGenerating || !certificatePreviewUrl || certificatePreviewRows.length !== certificateSkillOrder.length}>
                {certificateGenerating ? t("Generating certificate...") : t("Confirm and download certificate")} <Icon name="certificate" size={16} />
              </button>
            </div>
          </div>
          <div className="certificate-preview-pane">
            <div className="certificate-preview-badge">{t("PREVIEW ONLY · NOT ISSUED")}</div>
            {certificatePreviewUrl
              ? <iframe title={t("Certificate preview")} src={certificatePreviewUrl} />
              : <div className="certificate-preview-loading" role="status">{t("Preparing certificate preview...")}</div>}
          </div>
        </section>
      </div>}

      {completionDialog && <div className="modal-backdrop completion-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompletionDialog(null); }}>
        <section className="modal glass-panel completion-dialog" role="dialog" aria-modal="true" aria-labelledby="completion-dialog-title">
          <button className="modal-close" type="button" onClick={() => setCompletionDialog(null)} aria-label={t("Close")}><Icon name="close" size={19} /></button>
          <div className="modal-icon"><Icon name="certificate" size={25} /></div>
          <span className="eyebrow">{t("A MILESTONE WORTH CELEBRATING")}</span>
          <div className="claimed-certificate">
            <span className="certificate-star">✦</span>
            <span className="certificate-overline">{t("JOOLO · CERTIFICATE OF COMPLETION")}</span>
            <h2 id="completion-dialog-title">{t(certificateClaimed ? "Certificate claimed!" : "Congratulations!")}</h2>
            <p>{t("This recognizes ")}<strong>{claimedCertificate?.fullName || profileName}</strong>{t(" for completing the 40-day cosmic growth challenge.")}</p>
            <span className="certificate-days">{t("40 DAYS · CHALLENGE COMPLETE")}</span>
          </div>
          <p className="certificate-claim-note">{t(certificateClaimed ? "Your milestone is saved in your journey on this device." : "Your 40-day journey is complete. This certificate has been added to your milestones.")}</p>
          <button className="primary-button submit-button" type="button" disabled={!claimedCertificate || certificateGenerating} onClick={() => {
            if (claimedCertificate) void downloadClaimedCompletionCertificate(claimedCertificate);
          }}>{t(claimedCertificate ? "Download certificate again" : "Certificate already claimed")} <Icon name="certificate" size={16} /></button>
        </section>
      </div>}

      {bonusOpen && <div className="bonus-screen">
        <div className="stars stars-one" /><div className="stars stars-two" />
        <header className="topbar shell bonus-topbar">
          <a href="#top" className="brand" onClick={(event) => { event.preventDefault(); setBonusOpen(false); }} aria-label={t("JOolo home")}><span className="brand-mark">✦</span><span>JO<span className="brand-muted">O</span>LO<span className="brand-dot">.</span></span></a>
          <nav className="main-nav" aria-label={t("Main navigation")}>
            <button className="nav-link" onClick={() => { setBonusOpen(false); setLeaderboardOpen(true); }}>{t("Leaderboard")}</button>
            <button className="nav-link" onClick={() => { setBonusOpen(false); jumpToChallenges(); }}>{t("Challenge")}</button>
            <button className="nav-link active bonus-nav-active" aria-current="page">{t("Bonus")}</button>
          </nav>
          <div className="header-actions">{languageSelector}<button className="icon-button" onClick={openProfile} aria-label={t("Profile")}><Icon name="user" size={21} /></button></div>
        </header>
        <main className="bonus-content shell" aria-labelledby="bonus-title">
          <div className="bonus-title-row">
            <div><span className="eyebrow"><span className="eyebrow-line" /> {t("YOUR COSMIC TOOLKIT")}</span><h1 id="bonus-title">{t("Download ")}<span>{t("Bonus")}</span></h1><p>{t("Helpful little tools for the person you’re becoming.")}</p></div>
            <div className="bonus-heading-actions">
              {isAdmin && <a className="bonus-admin-link" href="/admin">{t("Manage bonuses")} <Icon name="arrow" size={15} /></a>}
              <button className={`bonus-search-toggle ${bonusSearchOpen ? "is-open" : ""}`} onClick={() => { setBonusSearchOpen((open) => !open); setBonusSearch(""); }} aria-label={t(bonusSearchOpen ? "Close search" : "Search bonuses")}><Icon name={bonusSearchOpen ? "close" : "search"} size={23} /></button>
            </div>
          </div>
          {bonusSearchOpen && <label className="bonus-search-field"><Icon name="search" size={17} /><input autoFocus value={bonusSearch} onChange={(event) => setBonusSearch(event.target.value)} placeholder={t("Search guides and trackers...")} aria-label={t("Search bonus resources")} /></label>}
          <div className="bonus-tabs" role="tablist" aria-label={t("Bonus resource type")}>
            <button className={bonusType === "ebook" ? "selected" : ""} role="tab" aria-selected={bonusType === "ebook"} onClick={() => setBonusType("ebook")}>{t("E-BOOK")}</button>
            <button className={bonusType === "tracker" ? "selected" : ""} role="tab" aria-selected={bonusType === "tracker"} onClick={() => setBonusType("tracker")}>{t("TRACKER")}</button>
          </div>
          <section className="bonus-resource-list" aria-label={t(bonusType === "ebook" ? "E-book downloads" : "Tracker downloads")}>
            {visibleUploadedResources.map((resource) => <article className="bonus-resource-card" key={resource.id}>
              <div className={`bonus-cover ${bonusType}`} style={{ backgroundImage: `linear-gradient(180deg,rgba(5,13,22,.02),rgba(6,13,23,.34)),url("${resource.image_url}")` }}>
                <span className="bonus-cover-brand">✦ JOOLO</span>
                <span className="bonus-cover-title">{resource.title}</span>
                <span className="bonus-file-badge">{bonusType === "ebook" ? "PDF" : "XLSX"}</span>
              </div>
              <div className="bonus-resource-info">
                <span className="bonus-category">{t(bonusType === "ebook" ? "E-BOOK" : "TRACKER")}</span>
                <h2>{resource.title}</h2>
                <p>{resource.description}</p>
                <span className="bonus-resource-meta">{bonusType === "ebook" ? "PDF · Google Drive" : "Excel · Google Drive"}</span>
                <a className="bonus-download-button" href={resource.download_url} target="_blank" rel="noreferrer">
                  {t("DOWNLOAD ")}{bonusType === "ebook" ? "PDF" : t("EXCEL")} <Icon name="arrow" size={16} />
                </a>
              </div>
            </article>)}
            {visibleBonusResources.map((resource) => <article className="bonus-resource-card" key={resource.title}>
              <div className={`bonus-cover ${bonusType}`} style={{ backgroundImage: `linear-gradient(180deg,rgba(5,13,22,.02),rgba(6,13,23,.34)),url("https://images.unsplash.com/${resource.image}?auto=format&fit=crop&w=650&h=460&q=82")` }}>
                <span className="bonus-cover-brand">✦ JOOLO</span>
                <span className="bonus-cover-title">{resource.title}</span>
                {bonusType === "tracker" && <span className="bonus-file-badge">XLSX</span>}
              </div>
              <div className="bonus-resource-info"><span className="bonus-category">{t(resource.category)}</span><h2>{t(resource.title)}</h2><p>{t(resource.description)}</p><span className="bonus-resource-meta">{t(resource.detail)}</span><button className="bonus-download-button" onClick={() => { void downloadBonus(resource, bonusType).catch((error: unknown) => { console.error("Unable to create bonus download", error); notify("Download couldn’t be created. Please try again."); }); }}>{t("DOWNLOAD ")}{bonusType === "ebook" ? "PDF" : "XLSX"} <Icon name="arrow" size={16} /></button></div>
            </article>)}
            {visibleBonusResources.length + visibleUploadedResources.length === 0 && <div className="bonus-empty"><Icon name="search" size={23} /><strong>{t("No resources found in this orbit.")}</strong><span>{t("Try a different title or category.")}</span><button onClick={() => setBonusSearch("")}>{t("Clear search")}</button></div>}
          </section>
          <footer className="bonus-footer"><span>✦ {t("Made for your becoming")}</span><button onClick={() => setBonusOpen(false)}>{t("Back to your journey ↑")}</button></footer>
        </main>
      </div>}

      {leaderboardOpen && <div className="leaderboard-screen">
        <div className="stars stars-one" /><div className="stars stars-two" />
        <header className="topbar shell leaderboard-topbar">
          <a href="#top" className="brand" onClick={(event) => { event.preventDefault(); setLeaderboardOpen(false); }} aria-label={t("JOolo home")}><span className="brand-mark">✦</span><span>JO<span className="brand-muted">O</span>LO<span className="brand-dot">.</span></span></a>
          <nav className="main-nav" aria-label={t("Main navigation")}>
            <button className="nav-link active leaderboard-nav-active" onClick={() => setLeaderboardOpen(false)}>{t("Leaderboard")}</button>
            <button className="nav-link" onClick={() => { setLeaderboardOpen(false); jumpToChallenges(); }}>{t("Challenge")}</button>
            <button className="nav-link" onClick={() => { setLeaderboardOpen(false); setBonusOpen(true); }}>{t("Bonus")}</button>
          </nav>
          <div className="header-actions">{languageSelector}<button className="icon-button" onClick={openProfile} aria-label={t("Profile")}><Icon name="user" size={21} /></button></div>
        </header>
        <main className="leaderboard-content shell" aria-labelledby="leaderboard-title">
          <div className="leaderboard-heading"><span className="eyebrow"><span className="eyebrow-line" /> {t("THE COSMIC COMMUNITY")}</span><h1 id="leaderboard-title">{t("Find your ")}<span>{t("orbit.")}</span></h1><p>{t("Every small step deserves a few coins.")}</p></div>
          <div className="leaderboard-tabs" role="tablist" aria-label={t("Leaderboard period")}>
            {(["daily", "weekly", "phase"] as const).map((period) => <button key={period} className={leaderboardPeriod === period ? "selected" : ""} role="tab" aria-selected={leaderboardPeriod === period} onClick={() => setLeaderboardPeriod(period)}>{t(period)}</button>)}
          </div>
          {leaderboardPeriod === "phase" ?           <section className="phase-progress-dashboard" aria-label={t("40-day progress dashboard")}>
            <div className="phase-progress-heading">
              <div>
                <span className="eyebrow"><span className="eyebrow-line" /> {t("YOUR 40-DAY JOURNEY")}</span>
                <h2>{t("Progress ")}<span>{t("in orbit.")}</span></h2>
                <p>{t("Track your daily coins across your 40-day journey.")}</p>
              </div>
              <div className="phase-progress-stats">
                <div><span>{t("COINS EARNED")}</span><strong>✦ {userTotalRecordedStardust.toLocaleString()}</strong></div>
                <div><span>{t("DAY ")}{selectedDay} {t("SCORE")}</span><strong>✦ {(dailyStardustByDay[String(selectedDay)] ?? 0).toLocaleString()}</strong></div>
              </div>
            </div>
            <div className="progress-chart-panel">
              <div className="progress-chart-topline">
                <div><span className="chart-kicker">{t("DAILY COINS")}</span><h3>{t("Day-by-day progress")}</h3></div>
                <span className="chart-unit">{t("COINS / DAY")}</span>
              </div>
              <div className="progress-chart-scroll">
                <svg className="progress-chart" viewBox="0 0 930 345" role="img" aria-labelledby="progress-chart-title progress-chart-description">
                  <title id="progress-chart-title">{t("Daily coin progress over 40 challenge days")}</title>
                  <desc id="progress-chart-description">{t("Your recorded daily coins are shown with a cyan line. Days without recorded progress are left blank.")}</desc>
                  {Array.from({ length: 6 }, (_, index) => {
                    const score = Math.round((chartYMax / 5) * (5 - index));
                    const y = chartBounds.top + (chartBounds.height / 5) * index;
                    return <g key={`y-${score}`}>
                      <line className="chart-grid-line" x1={chartBounds.left} x2={chartBounds.left + chartBounds.width} y1={y} y2={y} />
                      <text className="chart-axis-label" x={chartBounds.left - 12} y={y + 4} textAnchor="end">{score.toLocaleString("id-ID")}</text>
                    </g>;
                  })}
                  {[1, 5, 10, 15, 20, 25, 30, 35, 40].map((day) => <g key={`x-${day}`}>
                    <line className="chart-x-tick" x1={chartX(day)} x2={chartX(day)} y1={chartBounds.top + chartBounds.height} y2={chartBounds.top + chartBounds.height + 5} />
                    <text className="chart-axis-label" x={chartX(day)} y={chartBounds.top + chartBounds.height + 23} textAnchor="middle">{t("Day ")}{day}</text>
                  </g>)}
                  <line className="chart-axis-line" x1={chartBounds.left} x2={chartBounds.left} y1={chartBounds.top} y2={chartBounds.top + chartBounds.height} />
                  <line className="chart-axis-line" x1={chartBounds.left} x2={chartBounds.left + chartBounds.width} y1={chartBounds.top + chartBounds.height} y2={chartBounds.top + chartBounds.height} />
                  {userTrendSegments.map((segment, index) => <polyline
                    className="user-progress-line"
                    key={`user-line-${index}`}
                    points={segment.map((point) => `${chartX(point.day)},${chartY(point.score)}`).join(" ")}
                  />)}
                  {userRecordedPoints.map((point) => <circle className="user-progress-point" key={`user-point-${point.day}`} cx={chartX(point.day)} cy={chartY(point.score)} r="5">
                    <title>{`${t("Day ")}${point.day}: ${point.score.toLocaleString("id-ID")} ${t("coins earned")}`}</title>
                  </circle>)}
                  {userRecordedPoints.map((point) => {
                    const pointY = chartY(point.score);
                    return <text
                      className="user-progress-value"
                      key={`user-value-${point.day}`}
                      x={chartX(point.day)}
                      y={pointY < chartBounds.top + 22 ? pointY + 19 : pointY - 10}
                      textAnchor="middle"
                    >
                      {point.score.toLocaleString("id-ID")}
                    </text>;
                  })}
                </svg>
              </div>
              <div className="chart-legend" aria-label={t("Chart lines")}>
                <span className="chart-legend-item chart-user-legend"><i /> {t("You · daily coins")}</span>
              </div>
              <p className="chart-data-note">{t("Your line shows the coins you earned each day. Days without recorded progress are left blank.")}</p>
            </div>
          </section> : <>
            <p className="leaderboard-period-note">{t(leaderboardPeriod === "daily" ? "Daily coin totals for today's challenge day in WIB." : "Weekly coin totals for the last 7 days.")}</p>
            {leaderboardLoading
              ? <p className="leaderboard-state" role="status">{t("Loading leaderboard...")}</p>
              : leaderboardError
                ? <p className="leaderboard-state is-error" role="alert">{t(leaderboardError)}</p>
                : rankedLeaderboard.length === 0
                  ? <p className="leaderboard-state">{t("No coins earned in this period yet.")}</p>
                  : <>
                    <p className="leaderboard-top-ten-note">{t("Top 10 members by total coins earned.")}</p>
                    {topLeaders.length === 3 && <section className="podium" aria-label={t("Top three players")}>
                      {[{ leader: topLeaders[1], rank: 2 }, { leader: topLeaders[0], rank: 1 }, { leader: topLeaders[2], rank: 3 }].map(({ leader, rank }) => (
                        <article className={`podium-player podium-${rank}`} key={leader.userId}>
                          <div className="podium-rank">{rank === 1 && <span className="crown">♛</span>}{rank}</div>
                          <div className="podium-avatar-wrap"><Image src={leader.avatarUrl || (leader.gender === "man" ? "/AVATAR/Man/Ray.png" : "/AVATAR/Woman/Luna.png")} alt="" className="podium-avatar" width={240} height={240} sizes="(max-width: 560px) 105px, 138px" /><span className="avatar-glow" /></div>
                          <strong>{leader.displayName || t("JOolo member")}</strong><span className="podium-title">{t(leaderboardPeriod === "daily" ? "Daily coins" : "Weekly coins")}</span>
                          <div className="podium-score"><span className="leader-coin">✦</span>{leader.totalCoin.toLocaleString()}</div>
                        </article>
                      ))}
                    </section>}
                    <section className="leader-list" aria-label={t("Leaderboard ranks")}>
                      {(topLeaders.length < 3 ? topLeaders : remainingTopTenLeaders).map((leader) => {
                        const isYou = leader.userId === userId;
                        return <article className={`leader-list-row ${isYou ? "you" : ""}`} key={leader.userId}>
                          <span className="list-rank">{leader.rank}</span>
                          <Image className="list-avatar" src={leader.avatarUrl || (leader.gender === "man" ? "/AVATAR/Man/Ray.png" : "/AVATAR/Woman/Luna.png")} alt="" width={100} height={100} sizes="48px" />
                          <span className="list-player">{leader.displayName || t("JOolo member")}<small>{isYou ? t("Your cosmic journey") : t(leaderboardPeriod === "daily" ? "Daily coins" : "Weekly coins")}</small></span>
                          <span className="list-score"><span className="leader-coin">✦</span><b>{leader.totalCoin.toLocaleString()}</b></span>
                        </article>;
                      })}
                    </section>
                  </>}
          </>}
        </main>
      </div>}
      {journeyDatePickerOpen && <div className="modal-backdrop start-date-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setJourneyDatePickerOpen(false); }}>
        <section className="modal glass-panel start-date-dialog" role="dialog" aria-modal="true" aria-labelledby="start-date-title">
          <button className="modal-close" type="button" onClick={() => setJourneyDatePickerOpen(false)} aria-label={t("Close date picker")}><Icon name="close" size={19} /></button>
          <div className="modal-icon"><Icon name="calendar" size={25} /></div>
          <span className="eyebrow">{t("YOUR 40-DAY CHALLENGE")}</span>
          <h2 id="start-date-title">{t("Input your challenge start date.")}</h2>
          <p>{t("This date is saved to your Supabase account and marks the first day of your 40-day challenge.")}</p>
          <form onSubmit={saveJourneyStartDate}>
            <label htmlFor="journey-start-date">{t("CHALLENGE START DATE")}</label>
            <input
              id="journey-start-date"
              type="date"
              value={journeyStartDateDraft}
              onChange={(event) => setJourneyStartDateDraft(event.target.value)}
              disabled={journeyDateSaving}
              required
            />
            {journeyDateError && <p className="start-date-error" role="alert">{journeyDateError}</p>}
            <div className="start-date-dialog-actions">
              <button className="outline-button" type="button" onClick={() => setJourneyDatePickerOpen(false)} disabled={journeyDateSaving}>{t("Cancel")}</button>
              <button className="primary-button" type="submit" disabled={journeyDateSaving}>{journeyDateSaving ? t("Saving...") : t("Save start date")} <Icon name="check" size={16} /></button>
            </div>
          </form>
        </section>
      </div>}
      {toast && <div className="toast" role="status"><span>✦</span>{toast}</div>}
    </main>
  );
}
