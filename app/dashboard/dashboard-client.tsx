"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { strToU8, zipSync } from "fflate";
import { createClient } from "@/lib/supabase/client";
import type { BonusType, UploadedBonusResource } from "@/lib/bonus";
import type { PhaseDailyQuest } from "@/lib/phase-quests";

type Gender = "woman" | "man";
type LeaderboardPeriod = "daily" | "weekly" | "phase";
type Leader = { handle: string; title: string; avatar: string; daily: number; weekly: number; phase: number };
type BonusResource = { title: string; category: string; description: string; detail: string; image: string; rows?: string[][] };
type ProfileDialog = "edit" | "reset" | "certificate" | "feedback" | "logout" | null;
type CompletionDialog = "evaluation" | "certificate" | null;
type ProfileTheme = "dark" | "light";
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
  schedule?: "daily" | "weekly";
  frequency?: number;
  level?: "Easy" | "Medium" | "Hard";
  targetAmount?: number;
  targetUnit?: string;
  phaseFocus?: string;
};

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

const quotes = [
  "Every moment is a fresh beginning.",
  "Small steps every day add up to big change.",
  "You are allowed to be a work in progress.",
];

const leaderboard: Leader[] = [
  { handle: "@diana.love", title: "Nebula seeker", avatar: "photo-1534528741775-53994a69daeb", daily: 920, weekly: 8805, phase: 18920 },
  { handle: "@john_life", title: "Orbit explorer", avatar: "photo-1500648767791-00dcc994a43e", daily: 870, weekly: 8239, phase: 17640 },
  { handle: "@phil.gamer", title: "Cosmic voyager", avatar: "photo-1506794778202-cad84cf45f1d", daily: 845, weekly: 7987, phase: 16820 },
  { handle: "@kendal4848", title: "Stardust collector", avatar: "photo-1507003211169-0a1dd7228f2d", daily: 810, weekly: 7568, phase: 15450 },
  { handle: "@shiv.rajput", title: "Moon walker", avatar: "photo-1501196354995-cbb51c65aaea", daily: 780, weekly: 7532, phase: 14900 },
  { handle: "@sally.stewart45", title: "Dream chaser", avatar: "photo-1531123897727-8f129e1688ce", daily: 760, weekly: 7218, phase: 14330 },
  { handle: "@you", title: "Rising star", avatar: "photo-1534528741775-53994a69daeb", daily: 742, weekly: 7199, phase: 13980 },
  { handle: "@kabir_sen2345", title: "Quiet comet", avatar: "photo-1506794778202-cad84cf45f1d", daily: 715, weekly: 6980, phase: 13520 },
  { handle: "@natalie.fun", title: "Light finder", avatar: "photo-1524504388940-b1c1722653e1", daily: 690, weekly: 6757, phase: 12950 },
  { handle: "@veronica6794", title: "Star wanderer", avatar: "photo-1534528741775-53994a69daeb", daily: 674, weekly: 6540, phase: 12580 },
  { handle: "@alex.morning", title: "Early orbit", avatar: "photo-1500648767791-00dcc994a43e", daily: 651, weekly: 6290, phase: 12100 },
  { handle: "@luna.grows", title: "Moon gardener", avatar: "photo-1531123897727-8f129e1688ce", daily: 630, weekly: 6085, phase: 11720 },
  { handle: "@sam.writes", title: "Word constellation", avatar: "photo-1501196354995-cbb51c65aaea", daily: 612, weekly: 5920, phase: 11290 },
  { handle: "@mika.moves", title: "Moving meteor", avatar: "photo-1524504388940-b1c1722653e1", daily: 590, weekly: 5740, phase: 10960 },
  { handle: "@ari.sunrise", title: "Dawn seeker", avatar: "photo-1507003211169-0a1dd7228f2d", daily: 570, weekly: 5510, phase: 10510 },
  { handle: "@lee.reflects", title: "Inner galaxy", avatar: "photo-1506794778202-cad84cf45f1d", daily: 551, weekly: 5320, phase: 10120 },
  { handle: "@noah.next", title: "New horizon", avatar: "photo-1500648767791-00dcc994a43e", daily: 530, weekly: 5100, phase: 9760 },
];

const bonusResources: Record<BonusType, BonusResource[]> = {
  ebook: [
    { title: "The 40-Day Blueprint", category: "Focus", description: "A gentle, step-by-step guide to build better habits and become your next self.", detail: "Printable guide  |  PDF", image: "photo-1506784983877-45594efa4cbe" },
    { title: "Morning, Made Meaningful", category: "Productivity", description: "Create a calmer, more intentional morning with rituals that actually stick.", detail: "Printable guide  |  PDF", image: "photo-1497250681960-ef046c08a56e" },
    { title: "Mind Over Momentum", category: "Mindset", description: "Find your way forward when motivation gets quiet and life gets loud.", detail: "Printable guide  |  PDF", image: "photo-1519682337058-a94d519337bc" },
    { title: "Small Steps, Stronger Self", category: "Fitness", description: "Simple movement plans to feel stronger, more energized, and at home in your body.", detail: "Printable guide  |  PDF", image: "photo-1518611012118-696072aa579a" },
  ],
  tracker: [
    { title: "40-Day Habit Tracker", category: "Habit", description: "Track your daily rituals and celebrate every streak across your 40-day quest.", detail: "40-day planner  |  XLSX", image: "photo-1454165804606-c3d57bc86b40", rows: [["Day", "Morning ritual", "Move your body", "Read 10 pages", "Gratitude note", "Notes"]] },
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
  isAdmin,
  uploadedResources,
  initialStartDate,
  phaseDailyQuests,
  completedPhaseQuestIds: initialCompletedPhaseQuestIds,
}: {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  uploadedResources: UploadedBonusResource[];
  initialStartDate: string;
  phaseDailyQuests: PhaseDailyQuest[];
  completedPhaseQuestIds: string[];
}) {
  const router = useRouter();
  const [gender, setGender] = useState<Gender>("woman");
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges);
  const [selectedDay, setSelectedDay] = useState(1);
  const [journeyStartDate, setJourneyStartDate] = useState(initialStartDate);
  const [dailyStardustByDay, setDailyStardustByDay] = useState<Record<string, number>>({});
  const [challengeCompletionDays, setChallengeCompletionDays] = useState<Record<string, number>>({});
  const [journeyStartDateDraft, setJourneyStartDateDraft] = useState(initialStartDate);
  const [journeyDatePickerOpen, setJourneyDatePickerOpen] = useState(false);
  const [journeyDateSaving, setJourneyDateSaving] = useState(false);
  const [journeyDateError, setJourneyDateError] = useState("");
  const [completedPhaseQuestIds, setCompletedPhaseQuestIds] = useState(initialCompletedPhaseQuestIds);
  const [pendingPhaseQuestIds, setPendingPhaseQuestIds] = useState<string[]>([]);
  const [coins, setCoins] = useState(267);
  const [modalOpen, setModalOpen] = useState(false);
  const [taskSchedule, setTaskSchedule] = useState<"daily" | "weekly" | "2x" | "3x">("daily");
  const [taskLevel, setTaskLevel] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [taskName, setTaskName] = useState("");
  const [taskTargetAmount, setTaskTargetAmount] = useState("");
  const [taskUnit, setTaskUnit] = useState("pages");
  const [customTaskUnit, setCustomTaskUnit] = useState("");
  const [progressChallengeId, setProgressChallengeId] = useState<string | null>(null);
  const [progressTitle, setProgressTitle] = useState("");
  const [progressSchedule, setProgressSchedule] = useState<"daily" | "weekly" | "2x" | "3x">("daily");
  const [progressLevel, setProgressLevel] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [progressTarget, setProgressTarget] = useState("");
  const [progressUnit, setProgressUnit] = useState("pages");
  const [progressCustomUnit, setProgressCustomUnit] = useState("");
  const [confirmChallengeDelete, setConfirmChallengeDelete] = useState(false);
  const [completionDialog, setCompletionDialog] = useState<CompletionDialog>(null);
  const [certificateClaimed, setCertificateClaimed] = useState(false);
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
  const [leaderboardPage, setLeaderboardPage] = useState(0);
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setGender(readStored<Gender>("joolo-gender", "woman", userId));
    setChallenges(readStored<Challenge[]>("joolo-challenges", initialChallenges, userId));
    setCertificateClaimed(readStored<boolean>("joolo-certificate-claimed", false, userId));
    setJourneyStartDate(initialStartDate);
    setDailyStardustByDay(readStored<Record<string, number>>("joolo-daily-stardust", {}, userId));
    setChallengeCompletionDays(readStored<Record<string, number>>("joolo-challenge-completion-days", {}, userId));
    setCoins(readStored<number>("joolo-coins", 267, userId));
    setProfileName(readStored<string>("joolo-profile-name", name, userId));
    setProfileTheme(readStored<ProfileTheme>("joolo-profile-theme", "dark", userId));
    setHydrated(true);
  }, [userId, name, initialStartDate]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(`${userId}:joolo-gender`, JSON.stringify(gender));
    localStorage.setItem(`${userId}:joolo-challenges`, JSON.stringify(challenges));
    localStorage.setItem(`${userId}:joolo-certificate-claimed`, JSON.stringify(certificateClaimed));
    localStorage.setItem(`${userId}:joolo-daily-stardust`, JSON.stringify(dailyStardustByDay));
    localStorage.setItem(`${userId}:joolo-challenge-completion-days`, JSON.stringify(challengeCompletionDays));
    localStorage.setItem(`${userId}:joolo-coins`, JSON.stringify(coins));
    localStorage.setItem(`${userId}:joolo-profile-name`, JSON.stringify(profileName));
    localStorage.setItem(`${userId}:joolo-profile-theme`, JSON.stringify(profileTheme));
  }, [gender, challenges, certificateClaimed, dailyStardustByDay, challengeCompletionDays, coins, profileName, profileTheme, hydrated, userId]);

  const phaseQuestsForSelectedDay = phaseDailyQuests
    .filter((quest) => quest.day_number === selectedDay)
    .map<Challenge>((quest) => ({
      id: quest.id,
      title: quest.task_name,
      subtitle: quest.short_description,
      detail: `${quest.frequency} · ${quest.level} · 0 / ${quest.target}`,
      reward: quest.total_coin,
      accent: quest.level === "Easy" ? "cyan" : quest.level === "Medium" ? "pink" : "gold",
      image: "",
      done: completedPhaseQuestIds.includes(quest.id),
      level: quest.level,
      phaseFocus: quest.focus,
    }));
  const selectedPhase = phaseDailyQuests.find((quest) => quest.day_number === selectedDay);
  const activeChallenges = phaseQuestsForSelectedDay.length > 0
    ? [...phaseQuestsForSelectedDay, ...challenges.filter((challenge) => challenge.custom)]
    : challenges;
  const completed = activeChallenges.filter((challenge) => challenge.done).length;
  const journeyStartDateLabel = new Date(`${journeyStartDate}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dayNumber = Math.max(selectedDay, 1);
  const canClaimCertificate = dayNumber === 40 && challenges.length > 0 && completed === challenges.length;
  const completedStardust = activeChallenges.reduce((total, challenge) => total + (challenge.done ? challenge.reward : 0), 0);
  const progress = Math.round((completed / Math.max(activeChallenges.length, 1)) * 100);
  const quote = useMemo(() => quotes[(dayNumber - 1) % quotes.length], [dayNumber]);
  const rankedLeaders = useMemo(
    () => [...leaderboard].sort((a, b) => b[leaderboardPeriod] - a[leaderboardPeriod]),
    [leaderboardPeriod],
  );
  const dailyLeaders = useMemo(
    () => [...leaderboard].sort((a, b) => b.daily - a.daily).slice(0, 3),
    [],
  );
  const topLeaders = rankedLeaders.slice(0, 3);
  const pageLeaders = rankedLeaders.slice(3 + leaderboardPage * 7, 10 + leaderboardPage * 7);
  const chartBounds = { left: 72, top: 20, width: 820, height: 270 };
  const chartMaxValue = Math.max(1000, ...dailyLeaders.map((leader) => leader.daily), ...Object.values(dailyStardustByDay));
  const chartYMax = Math.ceil(chartMaxValue / 200) * 200;
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
  const levelMultiplier = taskLevel === "Easy" ? 1 : taskLevel === "Medium" ? 2 : 3;
  const enteredTarget = Number(taskTargetAmount);
  const taskReward = taskTargetAmount.trim() && Number.isFinite(enteredTarget) && enteredTarget > 0
    ? enteredTarget * levelMultiplier
    : levelMultiplier * 10;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function toggleChallenge(id: string) {
    const target = activeChallenges.find((item) => item.id === id);
    if (!target) return;
    const done = !target.done;
    if (target.phaseFocus) {
      if (pendingPhaseQuestIds.includes(id)) return;
      setPendingPhaseQuestIds((ids) => [...ids, id]);
      const supabase = createClient();
      try {
        const { error } = done
          ? await supabase.from("user_phase_quest_progress").insert({ user_id: userId, quest_id: id })
          : await supabase.from("user_phase_quest_progress").delete().eq("user_id", userId).eq("quest_id", id);

        if (error) {
          notify(`Quest progress could not be saved: ${error.message}`);
          return;
        }

        setCompletedPhaseQuestIds((ids) => done ? [...ids, id] : ids.filter((questId) => questId !== id));
        setCoins((value) => Math.max(0, value + (done ? target.reward : -target.reward)));
        if (done) {
          setChallengeCompletionDays((days) => ({ ...days, [id]: selectedDay }));
          setDailyStardustByDay((days) => ({ ...days, [selectedDay]: (days[String(selectedDay)] ?? 0) + target.reward }));
        } else {
          setDailyStardustByDay((days) => ({ ...days, [selectedDay]: Math.max(0, (days[String(selectedDay)] ?? 0) - target.reward) }));
          setChallengeCompletionDays((days) => {
            const nextDays = { ...days };
            delete nextDays[id];
            return nextDays;
          });
        }
      } catch (error) {
        notify(`Quest progress could not be saved: ${error instanceof Error ? error.message : "Unexpected error."}`);
      } finally {
        setPendingPhaseQuestIds((ids) => ids.filter((questId) => questId !== id));
      }
      return;
    }

    setChallenges((items) => items.map((item) => item.id === id ? { ...item, done } : item));
    setCoins((value) => Math.max(0, value + (done ? target.reward : -target.reward)));
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
    const [scheduleText = ""] = challenge.detail.split(" · ");
    const schedule = scheduleText.toLowerCase();
    const frequency = challenge.frequency ?? Number(schedule.match(/^(\d+)\s*x/i)?.[1]);
    const targetMatch = challenge.detail.match(/0\s*\/\s*([\d.]+)\s+([^·]+)/i);
    const levelMatch = challenge.detail.match(/\b(Easy|Medium|Hard)\b/i)?.[1];
    const storedUnit = challenge.targetUnit ?? targetMatch?.[2].trim() ?? "pages";
    const knownUnits = ["pages", "km", "minutes", "reps", "glasses", "times"];
    setProgressChallengeId(challenge.id);
    setProgressTitle(challenge.title);
    setProgressSchedule(schedule === "daily" || !/week/.test(schedule) && !frequency ? "daily" : schedule === "2x/week" || frequency === 2 ? "2x" : schedule === "3x/week" || frequency === 3 ? "3x" : "weekly");
    setProgressLevel(challenge.level ?? (levelMatch === "Medium" || levelMatch === "Hard" ? levelMatch : "Easy"));
    setProgressTarget(String(challenge.targetAmount ?? targetMatch?.[1] ?? ""));
    setProgressUnit(knownUnits.includes(storedUnit) ? storedUnit : "custom");
    setProgressCustomUnit(knownUnits.includes(storedUnit) ? "" : storedUnit);
    setConfirmChallengeDelete(false);
  }

  function updateChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const challenge = challenges.find((item) => item.id === progressChallengeId);
    if (!challenge) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const schedule = String(data.get("schedule") ?? "daily") as "daily" | "weekly" | "2x" | "3x";
    const frequency = schedule === "2x" ? 2 : schedule === "3x" ? 3 : schedule === "weekly" ? 1 : undefined;
    const rawTarget = String(data.get("target") ?? "").trim();
    const targetAmount = rawTarget ? Number(rawTarget) : null;
    const selectedUnit = String(data.get("unit") ?? "").trim();
    const targetUnit = selectedUnit === "custom" ? String(data.get("customUnit") ?? "").trim() : selectedUnit;
    const level = String(data.get("level") ?? "Easy") as "Easy" | "Medium" | "Hard";
    const multiplier = level === "Easy" ? 1 : level === "Medium" ? 2 : 3;
    if (!title || (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount <= 0 || !targetUnit))) {
      if (targetAmount !== null && selectedUnit === "custom" && !targetUnit) notify("Enter a custom target unit.");
      return;
    }
    const reward = targetAmount === null ? multiplier * 10 : targetAmount * multiplier;
    const scheduleDetail = schedule === "daily" ? "Daily" : schedule === "weekly" ? "Weekly" : `${frequency}x/Week`;
    const unitLabel = targetUnit === "times" ? targetAmount === 1 ? "time" : "times" : targetUnit;
    const targetDetail = targetAmount === null ? "Target open" : `0 / ${targetAmount} ${unitLabel}`;
    const detail = `${scheduleDetail} · ${level} · ${targetDetail}`;
    setChallenges((items) => items.map((item) => item.id === challenge.id ? {
      ...item,
      title,
      subtitle: detail,
      detail,
      reward,
      image: getTaskCover(title, gender),
      schedule: schedule === "daily" ? "daily" : "weekly",
      frequency,
      level,
      targetAmount: targetAmount ?? undefined,
      targetUnit: targetAmount === null ? undefined : targetUnit,
    } : item));
    if (challenge.done) {
      setCoins((value) => Math.max(0, value + reward - challenge.reward));
      const earnedOnDay = challengeCompletionDays[challenge.id] ?? selectedDay;
      setDailyStardustByDay((days) => ({ ...days, [earnedOnDay]: Math.max(0, (days[String(earnedOnDay)] ?? 0) + reward - challenge.reward) }));
    }
    setProgressChallengeId(null);
    notify("Challenge progress updated.");
  }

  function deleteProgressChallenge() {
    const challenge = challenges.find((item) => item.id === progressChallengeId);
    if (!challenge) return;
    setChallenges((items) => items.filter((item) => item.id !== challenge.id));
    if (challenge.done) {
      setCoins((value) => Math.max(0, value - challenge.reward));
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

  function addChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const schedule = String(data.get("schedule") ?? "daily") as "daily" | "weekly" | "2x" | "3x";
    const frequency = schedule === "2x" ? 2 : schedule === "3x" ? 3 : schedule === "weekly" ? 1 : undefined;
    const rawTarget = String(data.get("target") ?? "").trim();
    const targetAmount = rawTarget ? Number(rawTarget) : null;
    const selectedUnit = String(data.get("unit") ?? "").trim();
    const targetUnit = selectedUnit === "custom" ? String(data.get("customUnit") ?? "").trim() : selectedUnit;
    const level = String(data.get("level") ?? "Easy") as "Easy" | "Medium" | "Hard";
    const rewardMultiplier = level === "Easy" ? 1 : level === "Medium" ? 2 : 3;
    const reward = targetAmount === null ? rewardMultiplier * 10 : targetAmount * rewardMultiplier;
    if (!title || (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount <= 0 || !targetUnit))) {
      if (targetAmount !== null && selectedUnit === "custom" && !targetUnit) {
        notify("Enter a custom target unit.");
      }
      return;
    }
    const scheduleDetail = schedule === "daily" ? "Daily" : schedule === "weekly" ? "Weekly" : `${frequency}x/Week`;
    const unitLabel = targetUnit === "times" ? targetAmount === 1 ? "time" : "times" : targetUnit;
    const targetDetail = targetAmount === null ? "Target open" : `0 / ${targetAmount} ${unitLabel}`;
    setChallenges((items) => [...items, {
      id: `custom-${Date.now()}`,
      title,
      subtitle: `${scheduleDetail} · ${level} · ${targetDetail}`,
      detail: `${scheduleDetail} · ${level} · ${targetDetail}`,
      reward,
      accent: "gold",
      image: getTaskCover(title, gender),
      done: false,
      custom: true,
      schedule: schedule === "daily" ? "daily" : "weekly",
      frequency,
      level,
      targetAmount: targetAmount ?? undefined,
      targetUnit: targetAmount === null ? undefined : targetUnit,
    }]);
    setModalOpen(false);
    event.currentTarget.reset();
    setTaskName("");
    setTaskSchedule("daily");
    setTaskLevel("Easy");
    setTaskTargetAmount("");
    setTaskUnit("pages");
    setCustomTaskUnit("");
    notify("Challenge added to your journey!");
  }

  function selectGender(value: Gender) {
    setGender(value);
    notify(`Your journey is now personalized for ${value === "woman" ? "women" : "men"}.`);
  }

  function openTaskCreator() {
    setTaskSchedule("daily");
    setTaskLevel("Easy");
    setTaskName("");
    setTaskTargetAmount("");
    setTaskUnit("pages");
    setCustomTaskUnit("");
    setModalOpen(true);
  }

  function closeTaskCreator() {
    setModalOpen(false);
    setTaskSchedule("daily");
    setTaskLevel("Easy");
    setTaskName("");
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
      notify(`Your saved phase quest progress could not be reset: ${error.message}`);
      return;
    }

    setChallenges(initialChallenges);
    setCompletedPhaseQuestIds([]);
    setCertificateClaimed(false);
    setSelectedDay(1);
    setDailyStardustByDay({});
    setChallengeCompletionDays({});
    setCoins(267);
    setGender("woman");
    setProfileName(name);
    setProfileTheme("dark");
    setProfileDialog(null);
    ["joolo-gender", "joolo-challenges", "joolo-certificate-claimed", "joolo-daily-stardust", "joolo-challenge-completion-days", "joolo-coins", "joolo-profile-name", "joolo-profile-theme"].forEach((key) => localStorage.removeItem(`${userId}:${key}`));
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
    const { error } = await supabase
      .from("challenge_settings")
      .upsert(
        { user_id: userId, start_date: journeyStartDateDraft, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    setJourneyDateSaving(false);
    if (error) {
      setJourneyDateError(`Tanggal mulai gagal disimpan: ${error.message}`);
      return;
    }

    setJourneyStartDate(journeyStartDateDraft);
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
        <p className="login-loading" role="status">Opening your orbit...</p>
      </main>
    );
  }

  return (
    <main className="cosmos">
      <div className="stars stars-one" /><div className="stars stars-two" />
      <div className="nebula nebula-left" /><div className="nebula nebula-right" />
      <header className="topbar shell">
        <a href="#top" className="brand" aria-label="JOolo home"><span className="brand-mark">✦</span><span>JO<span className="brand-muted">O</span>LO<span className="brand-dot">.</span></span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className="nav-link" onClick={() => setLeaderboardOpen(true)}>Leaderboard</button>
          <a className={`nav-link ${bonusOpen ? "" : "active"}`} href="#calendar" onClick={() => setBonusOpen(false)}>Challenge</a>
          <button className={`nav-link ${bonusOpen ? "active bonus-nav-active" : ""}`} onClick={() => { setBonusOpen(true); setBonusSearch(""); setBonusSearchOpen(false); }}>Bonus</button>
        </nav>
        <div className="header-actions">
          <button className="icon-button language-button" onClick={() => notify("Language: English")} aria-label="Language"><Icon name="globe" size={19} /></button>
          <button className="icon-button" onClick={openProfile} aria-label="Profile"><Icon name="user" size={21} /></button>
          <a className="mobile-cta" href="#today">Today <Icon name="arrow" size={16} /></a>
        </div>
      </header>

      <div className="shell page-content" id="top">
        <section className="hero-row" aria-label="Your journey overview">
          <div className="hero-intro">
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT CHAPTER STARTS HERE</div>
            <h1>Become who<br /><span>you came here to be.</span></h1>
            <p>Forty days. A few small promises. A whole new orbit.</p>
            <a className="primary-button" href="#today">Continue your journey <Icon name="arrow" size={17} /></a>
          </div>
          <div className="overview-cards">
            <div className="overview-card phase-card">
              <div className="phase-emblem"><Icon name="sparkles" size={35} /></div>
              <div><span className="card-kicker">YOUR CURRENT PHASE</span><strong>{selectedPhase?.phase_category_id.replace("PHASE_", "Phase ") ?? "Phase 01"} <span>·</span> {selectedPhase?.phase_name ?? "Awakening"}</strong><small>{selectedPhase?.focus ?? "Every journey begins with a spark."}</small></div>
              <span className="phase-index">{selectedPhase?.phase_category_id.replace("PHASE_", "") ?? "01"}</span>
            </div>
            <div className="overview-card stat-card">
              <span className="stat-icon coin-icon">✦</span><strong>{coins}</strong><span className="stat-label">STARDUST</span>
            </div>
            <div className="overview-card streak-card">
              <div className="streak-top"><span className="card-kicker">YOUR STREAK</span><span className="streak-fire"><Icon name="flame" size={16} /> 3 days</span></div>
              <div className="hearts" aria-label="3 day streak"><span>✦</span><span>✦</span><span>✦</span><span className="dim">✦</span><span className="dim">✦</span></div>
              <small>Keep showing up. It’s working.</small>
            </div>
            <button className="overview-card start-card start-date-control" type="button" onClick={openJourneyDatePicker} aria-label={`Change challenge start date, currently ${journeyStartDateLabel}`}>
              <span className="start-dot" />
              <span className="start-date-caption">CHALLENGE START</span>
              <strong>{journeyStartDateLabel}</strong>
              <span className="start-date-edit">Input start date</span>
            </button>
          </div>
        </section>

        <section className="calendar-panel glass-panel" id="calendar">
          <div className="section-heading calendar-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> THE 40-DAY QUEST</div><h2>Your map to <span>more you.</span></h2></div>
            <div className="phase-pill"><span className="phase-light" /> {selectedPhase?.phase_category_id.replace("_", " ") ?? "PHASE 01"} <b>{selectedPhase?.phase_name.toUpperCase() ?? "AWAKENING"}</b></div>
          </div>
          <div className="calendar-grid" role="group" aria-label="Select a challenge day">
            {Array.from({ length: 40 }, (_, index) => {
              const day = index + 1;
              const isCurrent = day === selectedDay;
              const isPast = day < selectedDay;
              return <button key={day} className={`day-cell ${isCurrent ? "current" : ""} ${isPast ? "past" : ""}`} onClick={() => setSelectedDay(day)} aria-label={`Day ${day}${isCurrent ? ", selected" : ""}`} aria-pressed={isCurrent}>
                <span>{String(day).padStart(2, "0")}</span><i className={isPast ? "complete-dot" : ""} />
              </button>;
            })}
          </div>
          <div className="calendar-footer"><span><span className="legend-dot current-dot" /> TODAY</span><span><span className="legend-dot complete-dot" /> COMPLETE</span><span className="calendar-note">One day at a time. You’re right on track.</span></div>
        </section>

        <section className="daily-section" id="today">
          <div className="daily-heading">
            <div className="day-title-wrap"><div className="day-label">YOUR DAILY QUEST</div><h2>DAY <span>{String(dayNumber).padStart(2, "0")}</span></h2><p className="daily-quote">“{quote}” <span>— T.S. Eliot</span></p></div>
            <div className="daily-controls">
              <div className="progress-chip"><span className="progress-ring">{progress}<small>%</small></span><span><b>{completed} OF {activeChallenges.length}</b><small>QUESTS DONE</small></span></div>
              <button className="add-button" onClick={openTaskCreator} aria-label="Add a challenge"><Icon name="plus" size={23} /><span>Add quest</span></button>
            </div>
          </div>
          <div className="gender-control" id="profile-personalization" aria-label="Personalize challenge photos">
            <span>PERSONALIZE YOUR JOURNEY</span>
            <div className="gender-switch" role="group" aria-label="Choose your avatar style">
              <button className={gender === "woman" ? "selected" : ""} onClick={() => selectGender("woman")} aria-pressed={gender === "woman"}>Woman</button>
              <button className={gender === "man" ? "selected" : ""} onClick={() => selectGender("man")} aria-pressed={gender === "man"}>Man</button>
            </div>
          </div>
          <div className="challenge-list">
            {activeChallenges.map((challenge, index) => {
              const image = challenge.custom || challenge.phaseFocus ? challenge.image : index < 2 ? challengeImages[gender][index === 0 ? "run" : "read"] : "";
              const coverImage = challenge.image || image;
              return <article className={`challenge-card ${challenge.accent} ${challenge.done ? "is-done" : ""} ${challenge.custom ? "custom-card" : ""}`} key={challenge.id} style={coverImage ? { backgroundImage: `linear-gradient(90deg, rgba(8, 17, 31, .98) 0%, rgba(8, 17, 31, .91) 38%, rgba(8, 17, 31, .31) 100%), url("${coverImage}")` } : undefined}>
                {!challenge.phaseFocus && <button className="challenge-cover-edit" type="button" onClick={() => openProgressEditor(challenge)} aria-label={`Edit progress for ${challenge.title}`} title="Edit quest progress" />}
                <div className="card-corner" />
                <div className="reward-tag"><span>✦</span> {challenge.reward} <small>XP</small></div>
                <div className="challenge-content"><span className="challenge-category">{challenge.phaseFocus ?? (challenge.custom ? "YOUR QUEST" : index === 0 ? "BODY · MOVEMENT" : index === 1 ? "MIND · LEARNING" : "SOUL · REFLECTION")}</span><h3>{challenge.title}</h3><p className="challenge-subtitle">{challenge.subtitle}</p><div className="challenge-detail"><span>{challenge.detail.split(" · ")[0]}</span><i /> <span>{challenge.detail.split(" · ")[1]}</span><i /> <span>{challenge.done ? "Complete ✓" : challenge.detail.split(" · ")[2]}</span></div></div>
                <button className="complete-button" onClick={() => toggleChallenge(challenge.id)} disabled={pendingPhaseQuestIds.includes(challenge.id)} aria-label={`${challenge.done ? "Mark incomplete" : "Complete"} ${challenge.title}`} aria-pressed={challenge.done}><Icon name="check" size={22} /><span>{pendingPhaseQuestIds.includes(challenge.id) ? "Saving..." : challenge.done ? "Completed" : "Complete quest"}</span></button>
                <div className="card-progress"><span style={{ width: challenge.done ? "100%" : "18%" }} /></div>
              </article>;
            })}
          </div>
          {dayNumber === 40 && <div className={`day-40-actions ${canClaimCertificate ? "unlocked" : "locked"}`} aria-label="40-day challenge completion">
            {!canClaimCertificate && <p className="day-40-lock-note">Complete all daily quests to unlock these actions.</p>}
            <button className="day-40-action-button evaluation-action" type="button" disabled={!canClaimCertificate} title={canClaimCertificate ? "View your 40-day evaluation results" : "Complete all quests to unlock"} onClick={() => {
              if (canClaimCertificate) setCompletionDialog("evaluation");
            }}>
              <Icon name="sparkles" size={19} /> 40-Day Evaluation Results <Icon name="arrow" size={17} />
            </button>
            <button className={`day-40-action-button certificate-action ${certificateClaimed ? "claimed" : ""}`} type="button" disabled={!canClaimCertificate} title={canClaimCertificate ? "Claim your completion certificate" : "Complete all quests to unlock"} onClick={() => {
              if (!canClaimCertificate) return;
              if (!certificateClaimed) setCertificateClaimed(true);
              setCompletionDialog("certificate");
            }}>
              <Icon name="certificate" size={19} /> {certificateClaimed ? "Certificate Claimed" : "Claim Certificate"} <Icon name="arrow" size={17} />
            </button>
          </div>}
        </section>

        <section className="rewards-panel glass-panel" id="rewards">
          <div className="reward-orb"><Icon name="trophy" size={28} /></div>
          <div className="reward-copy"><span className="eyebrow"><span className="eyebrow-line" /> LITTLE WINS, BIG ENERGY</span><h2>Your next reward is <span>closer than you think.</span></h2><p>Complete quests, collect stardust, and unlock the next phase of your story.</p></div>
          <button className="outline-button" onClick={() => { setBonusOpen(true); setBonusSearch(""); setBonusSearchOpen(false); }}>Explore rewards <Icon name="arrow" size={16} /></button>
        </section>

        <footer className="footer"><a href="#top" className="footer-brand">✦ JOolo<span>.</span></a><span>Made for your becoming <i>✧</i> 2026</span><a href="#top">Back to the stars ↑</a></footer>
      </div>

      {modalOpen && <div className="create-task-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTaskCreator(); }}>
        <section className="create-task-screen" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
          <header className="create-task-heading"><button className="create-task-back" type="button" onClick={closeTaskCreator} aria-label="Back to challenge"><Icon name="back" size={23} /></button><h2 id="create-task-title">Create Task</h2><span /></header>
          <form className="create-task-form" onSubmit={addChallenge}>
            <label className="task-field-label" htmlFor="challenge-title">Task name</label>
            <input className="task-title-input" id="challenge-title" name="title" value={taskName} onChange={(event) => setTaskName(event.currentTarget.value)} placeholder="e.g. Run 5 km, read 10 pages..." maxLength={60} required autoFocus />
            <div className="task-image-picker" role="img" aria-label={`Automatically selected cover for ${taskName || "your task"}`}>
              <img src={getTaskCover(taskName, gender)} alt="" />
              <span className="task-image-scrim" />
              <span className="task-image-hint"><Icon name="sparkles" size={18} />Cover otomatis mengikuti nama task</span>
              <span className="task-image-auto-badge">AUTO MATCH</span>
            </div>
            <label className="task-field schedule-field">
              <span className="task-field-label">Time</span>
              <select name="schedule" value={taskSchedule} onChange={(event) => setTaskSchedule(event.currentTarget.value as "daily" | "weekly" | "2x" | "3x")} aria-label="Time">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="2x">2x/Week</option>
                <option value="3x">3x/Week</option>
              </select>
            </label>
            <div className="task-field-grid">
              <label className="task-field"><span className="task-field-label">Level</span><select name="level" value={taskLevel} onChange={(event) => setTaskLevel(event.currentTarget.value as "Easy" | "Medium" | "Hard")}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
              <label className="task-field"><span className="task-field-label">Stardust reward</span><div className="task-reward-preview"><span>✦</span><output aria-live="polite">{taskReward.toLocaleString()} stardust</output></div><small className="task-reward-hint">{taskTargetAmount ? `${taskTargetAmount} × ${levelMultiplier} (${taskLevel.toLowerCase()})` : `${taskLevel} default reward`}</small><input type="hidden" name="reward" value={taskReward} /></label>
            </div>
            <fieldset className="task-fieldset target-fieldset">
              <legend className="task-field-label">Target</legend>
              <div className="target-inputs"><input aria-label="Target amount" name="target" type="number" min="0.1" step="any" placeholder="Amount..." value={taskTargetAmount} onChange={(event) => setTaskTargetAmount(event.currentTarget.value)} /><span className="target-divider">/</span><select name="unit" aria-label="Target unit" value={taskUnit} onChange={(event) => setTaskUnit(event.currentTarget.value)}><option value="pages">pages</option><option value="km">km</option><option value="minutes">minutes</option><option value="reps">reps</option><option value="glasses">glasses</option><option value="times">times</option><option value="custom">Custom / Manual</option></select></div>
              {taskUnit === "custom" && <input className="custom-target-unit" aria-label="Custom target unit" name="customUnit" value={customTaskUnit} onChange={(event) => setCustomTaskUnit(event.currentTarget.value)} placeholder="Enter your unit (e.g. chapters)" maxLength={24} required={Boolean(taskTargetAmount.trim())} />}
              <small className="task-target-hint">Optional · Stardust = target × level multiplier</small>
            </fieldset>
            <button className="create-task-submit" type="submit">Create task <Icon name="arrow" size={20} /></button>
          </form>
        </section>
      </div>}

      {progressChallengeId && <div className="progress-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProgressChallengeId(null); }}>
        <section className="progress-editor-screen" role="dialog" aria-modal="true" aria-labelledby="progress-editor-title">
          <header className="progress-editor-heading">
            <button className="progress-editor-back" type="button" onClick={() => setProgressChallengeId(null)} aria-label="Back to challenges"><Icon name="back" size={23} /></button>
            <h2 id="progress-editor-title">Progress</h2>
            <button className="progress-editor-delete" type="button" onClick={() => setConfirmChallengeDelete(true)} aria-label="Delete challenge"><Icon name="trash" size={22} /></button>
          </header>
          <form className="progress-editor-form" onSubmit={updateChallenge}>
            <label className="progress-editor-label" htmlFor="progress-task-name">Task name</label>
            <input className="progress-editor-input progress-title-input" id="progress-task-name" name="title" value={progressTitle} onChange={(event) => setProgressTitle(event.currentTarget.value)} maxLength={60} required />
            <div className="progress-editor-cover">
              <img src={getTaskCover(progressTitle, gender)} alt={`Cover for ${progressTitle || "challenge"}`} />
              <span><Icon name="sparkles" size={15} /> Cover updates with task name</span>
            </div>
            <label className="progress-editor-field">
              <span className="progress-editor-label">Time</span>
              <select name="schedule" value={progressSchedule} onChange={(event) => setProgressSchedule(event.currentTarget.value as "daily" | "weekly" | "2x" | "3x")}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="2x">2x/Week</option>
                <option value="3x">3x/Week</option>
              </select>
            </label>
            <label className="progress-editor-field">
              <span className="progress-editor-label">Level</span>
              <select name="level" value={progressLevel} onChange={(event) => setProgressLevel(event.currentTarget.value as "Easy" | "Medium" | "Hard")}>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </label>
            <fieldset className="progress-editor-target">
              <legend className="progress-editor-label">Achievement</legend>
              <div className="progress-editor-target-row">
                <input aria-label="Achievement amount" name="target" type="number" min="0.1" step="any" placeholder="Amount..." value={progressTarget} onChange={(event) => setProgressTarget(event.currentTarget.value)} />
                <span className="progress-editor-divider">/</span>
                <select name="unit" aria-label="Achievement unit" value={progressUnit} onChange={(event) => setProgressUnit(event.currentTarget.value)}>
                  <option value="pages">Pages</option>
                  <option value="km">KM</option>
                  <option value="minutes">Minutes</option>
                  <option value="reps">Reps</option>
                  <option value="glasses">Glasses</option>
                  <option value="times">Times</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {progressUnit === "custom" && <input className="progress-editor-custom-unit" aria-label="Custom achievement unit" name="customUnit" value={progressCustomUnit} onChange={(event) => setProgressCustomUnit(event.currentTarget.value)} placeholder="Enter custom unit" maxLength={24} required={Boolean(progressTarget.trim())} />}
              <small>Enter a target amount and unit for this quest.</small>
            </fieldset>
            <button className="progress-editor-update" type="submit">Update <Icon name="check" size={19} /></button>
          </form>
          {confirmChallengeDelete && <div className="progress-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmChallengeDelete(false); }}>
            <section className="progress-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-challenge-title">
              <div className="progress-delete-icon"><Icon name="trash" size={22} /></div>
              <h3 id="delete-challenge-title">Delete this quest?</h3>
              <p>This removes the challenge and its progress from your journey.</p>
              <div className="progress-delete-actions">
                <button type="button" onClick={() => setConfirmChallengeDelete(false)}>Keep quest</button>
                <button type="button" onClick={deleteProgressChallenge}>Delete quest</button>
              </div>
            </section>
          </div>}
        </section>
      </div>}

      {profileOpen && <div className={`profile-screen ${profileTheme === "light" ? "profile-light" : ""}`}>
        <div className="stars stars-one" /><div className="stars stars-two" />
        <section className="profile-content shell" aria-labelledby="profile-title">
          <header className="profile-heading">
            <button className="profile-back" onClick={() => setProfileOpen(false)} aria-label="Back to journey"><Icon name="back" size={23} /></button>
            <h1 id="profile-title">Profile</h1>
            <span className="profile-heading-spacer" />
          </header>
          <section className="profile-identity profile-panel">
            <div className="profile-avatar-frame"><img src={gender === "woman" ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=360&h=360&q=85" : "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=360&h=360&q=85"} alt="Profile avatar" /></div>
            <div className="profile-identity-copy"><span className="profile-kicker">YOUR COSMIC JOURNEY</span><h2>{profileName}</h2><span className="profile-handle">{email}</span><button className="profile-edit-button" onClick={() => setProfileDialog("edit")}>Edit profile <Icon name="chevron" size={14} /></button></div>
            <div className="profile-stats">
              <div><Icon name="sparkles" size={18} /><span>PHASE 1</span></div>
              <div><Icon name="trophy" size={18} /><span>{completed} <small>quests</small></span></div>
              <div><span className="profile-coin">✦</span><span>{coins} <small>stardust</small></span></div>
            </div>
          </section>
          <section className="profile-panel profile-preferences">
            <span className="profile-section-label">PREFERENCES</span>
            <div className="profile-preference-row"><span className="profile-row-icon"><Icon name="settings" size={24} /></span><strong>Appearance</strong><div className="appearance-switch" role="group" aria-label="Appearance theme"><button className={profileTheme === "dark" ? "selected" : ""} aria-pressed={profileTheme === "dark"} onClick={() => setProfileTheme("dark")}><Icon name="moon" size={17} /> Dark</button><button className={profileTheme === "light" ? "selected" : ""} aria-pressed={profileTheme === "light"} onClick={() => setProfileTheme("light")}><Icon name="sun" size={17} /> Light</button></div></div>
          </section>
          <section className="profile-panel">
            <span className="profile-section-label">ACHIEVEMENTS</span>
            <button className="profile-action-row certificate-row" disabled={!canClaimCertificate} onClick={() => canClaimCertificate && setCompletionDialog("certificate")}><span className="profile-row-icon"><Icon name="certificate" size={25} /></span><strong>Claim Certificate</strong><span className="certificate-progress">{certificateClaimed ? "CLAIMED" : canClaimCertificate ? "COMPLETE 40 DAYS" : "AVAILABLE ON DAY 40"}</span><Icon name="chevron" size={21} /></button>
          </section>
          <section className="profile-panel profile-data-panel">
            <span className="profile-section-label">DATA</span>
            <button className="profile-action-row reset-row" onClick={() => setProfileDialog("reset")}><span className="profile-row-icon"><Icon name="trash" size={23} /></span><span className="profile-action-copy"><strong>Reset Data</strong><small>Clear your progress and start again from day one.</small></span><Icon name="chevron" size={21} /></button>
          </section>
          <section className="profile-panel">
            <span className="profile-section-label">APP GUIDE</span>
            <button className={`profile-action-row guide-row ${expandedGuide === "how" ? "expanded" : ""}`} onClick={() => setExpandedGuide((value) => value === "how" ? null : "how")}><span className="profile-row-icon"><Icon name="book" size={24} /></span><strong>How to Use</strong><Icon name="chevron" size={21} /></button>
            {expandedGuide === "how" && <p className="profile-guide-copy">Choose a day on your 40-day map, complete a small daily quest, and collect stardust as you build consistency. Your progress is saved on this device.</p>}
            <button className={`profile-action-row guide-row ${expandedGuide === "points" ? "expanded" : ""}`} onClick={() => setExpandedGuide((value) => value === "points" ? null : "points")}><span className="profile-row-icon"><Icon name="star" size={24} /></span><strong>Points Explained</strong><Icon name="chevron" size={21} /></button>
            {expandedGuide === "points" && <p className="profile-guide-copy">Each completed quest earns the stardust shown on its card. Your balance appears here and on your journey dashboard.</p>}
          </section>
          <section className="profile-panel">
            <span className="profile-section-label">SUPPORT</span>
            <a className="profile-action-row guide-row" href="mailto:hello@joolo.app?subject=JOolo%20support"><span className="profile-row-icon"><Icon name="support" size={24} /></span><strong>Customer Service</strong><Icon name="chevron" size={21} /></a>
            <button className="profile-action-row guide-row" onClick={() => setProfileDialog("feedback")}><span className="profile-row-icon"><Icon name="message" size={24} /></span><strong>Feedback</strong><Icon name="chevron" size={21} /></button>
          </section>
          <button className="profile-logout" onClick={() => setProfileDialog("logout")}><Icon name="logout" size={17} /> Log Out</button>
          <footer className="profile-version">JOOLO <span>v1.0.0</span><i>✦</i></footer>
        </section>
        {profileDialog && <div className="modal-backdrop profile-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileDialog(null); }}>
          <section className="modal glass-panel profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title">
            <button className="modal-close" onClick={() => setProfileDialog(null)} aria-label="Close"><Icon name="close" size={19} /></button>
            <div className="modal-icon"><Icon name={profileDialog === "reset" ? "trash" : profileDialog === "certificate" ? "certificate" : profileDialog === "logout" ? "logout" : profileDialog === "feedback" ? "message" : "sparkles"} size={25} /></div>
            {profileDialog === "edit" && <><span className="eyebrow">MAKE IT YOURS</span><h2 id="profile-dialog-title">Edit your profile.</h2><p>Choose the name you want to see on your journey.</p><form onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("name") ?? "").trim(); if (value) setProfileName(value); setProfileDialog(null); notify("Profile updated."); }}><label htmlFor="profile-name">Display name</label><input id="profile-name" name="name" defaultValue={profileName} maxLength={32} required /><button className="primary-button submit-button" type="submit">Save profile <Icon name="check" size={16} /></button></form></>}
            {profileDialog === "reset" && <><span className="eyebrow">A FRESH ORBIT</span><h2 id="profile-dialog-title">Reset your journey?</h2><p>This clears your saved quests, stardust, and preferences on this device. This can’t be undone.</p><div className="profile-dialog-actions"><button className="outline-button" onClick={() => setProfileDialog(null)}>Keep my progress</button><button className="profile-danger-button" onClick={resetJourney}>Reset everything</button></div></>}
            {profileDialog === "certificate" && <><span className="eyebrow">YOUR NEXT MILESTONE</span><h2 id="profile-dialog-title">Your 40-day orbit awaits.</h2><p>Reach Day 40 and complete all your daily quests to unlock your certificate.</p><button className="primary-button submit-button" onClick={() => { setProfileDialog(null); setProfileOpen(false); setSelectedDay(40); document.getElementById("calendar")?.scrollIntoView({ behavior: "smooth" }); }}>Go to day 40 <Icon name="arrow" size={16} /></button></>}
            {profileDialog === "feedback" && <><span className="eyebrow">HELP US GROW</span><h2 id="profile-dialog-title">Send a little feedback.</h2><p>What could make your next orbit even better?</p><form onSubmit={(event) => { event.preventDefault(); setProfileDialog(null); notify("Thanks for helping JOolo grow!"); }}><label htmlFor="feedback-message">Your feedback</label><textarea id="feedback-message" name="feedback" rows={4} maxLength={500} placeholder="Share an idea or tell us how it’s going..." required /><button className="primary-button submit-button" type="submit">Send feedback <Icon name="arrow" size={16} /></button></form></>}
            {profileDialog === "logout" && <><span className="eyebrow">YOUR ACCOUNT</span><h2 id="profile-dialog-title">Ready to head out?</h2><p>You’ll be securely signed out. Your journey progress will stay saved on this device.</p><button className="primary-button submit-button" onClick={logOut}>Log out <Icon name="logout" size={16} /></button></>}
          </section>
        </div>}
      </div>}

      {completionDialog && <div className="modal-backdrop completion-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompletionDialog(null); }}>
        <section className="modal glass-panel completion-dialog" role="dialog" aria-modal="true" aria-labelledby="completion-dialog-title">
          <button className="modal-close" type="button" onClick={() => setCompletionDialog(null)} aria-label="Close"><Icon name="close" size={19} /></button>
          <div className="modal-icon"><Icon name={completionDialog === "evaluation" ? "sparkles" : "certificate"} size={25} /></div>
          {completionDialog === "evaluation" ? <>
            <span className="eyebrow">YOUR JOURNEY, REFLECTED</span>
            <h2 id="completion-dialog-title">40-day evaluation.</h2>
            <p>You made it to the final day and completed every quest in your challenge.</p>
            <div className="evaluation-stats">
              <div><span>QUESTS COMPLETED</span><strong>{completed} / {challenges.length}</strong></div>
              <div><span>STARDUST EARNED</span><strong>✦ {completedStardust.toLocaleString()}</strong></div>
              <div><span>JOURNEY</span><strong>40 days</strong></div>
            </div>
            <div className="evaluation-quest-list">{challenges.map((challenge) => <div key={challenge.id}><span className="evaluation-check"><Icon name="check" size={14} /></span><span>{challenge.title}</span><strong>✦ {challenge.reward}</strong></div>)}</div>
            <button className="primary-button submit-button" type="button" onClick={() => setCompletionDialog(null)}>Celebrate your progress <Icon name="sparkles" size={16} /></button>
          </> : <>
            <span className="eyebrow">A MILESTONE WORTH CELEBRATING</span>
            <div className="claimed-certificate">
              <span className="certificate-star">✦</span>
              <span className="certificate-overline">JOOLO · CERTIFICATE OF COMPLETION</span>
              <h2 id="completion-dialog-title">{certificateClaimed ? "Certificate claimed!" : "Congratulations!"}</h2>
              <p>This recognizes <strong>{profileName}</strong> for completing the 40-day cosmic growth challenge.</p>
              <span className="certificate-days">40 DAYS · {completed} QUESTS COMPLETE</span>
            </div>
            <p className="certificate-claim-note">{certificateClaimed ? "Your milestone is saved in your journey on this device." : "Your 40-day journey is complete. This certificate has been added to your milestones."}</p>
            <button className="primary-button submit-button" type="button" onClick={() => setCompletionDialog(null)}>Continue your journey <Icon name="arrow" size={16} /></button>
          </>}
        </section>
      </div>}

      {bonusOpen && <div className="bonus-screen">
        <div className="stars stars-one" /><div className="stars stars-two" />
        <header className="topbar shell bonus-topbar">
          <a href="#top" className="brand" onClick={(event) => { event.preventDefault(); setBonusOpen(false); }} aria-label="JOolo home"><span className="brand-mark">✦</span><span>JO<span className="brand-muted">O</span>LO<span className="brand-dot">.</span></span></a>
          <nav className="main-nav" aria-label="Main navigation">
            <button className="nav-link" onClick={() => { setBonusOpen(false); setLeaderboardOpen(true); }}>Leaderboard</button>
            <button className="nav-link" onClick={() => { setBonusOpen(false); jumpToChallenges(); }}>Challenge</button>
            <button className="nav-link active bonus-nav-active" aria-current="page">Bonus</button>
          </nav>
          <div className="header-actions"><button className="icon-button language-button" onClick={() => notify("Language: English")} aria-label="Language"><Icon name="globe" size={19} /></button><button className="icon-button" onClick={openProfile} aria-label="Profile"><Icon name="user" size={21} /></button></div>
        </header>
        <main className="bonus-content shell" aria-labelledby="bonus-title">
          <div className="bonus-title-row">
            <div><span className="eyebrow"><span className="eyebrow-line" /> YOUR COSMIC TOOLKIT</span><h1 id="bonus-title">Download <span>Bonus</span></h1><p>Helpful little tools for the person you’re becoming.</p></div>
            <div className="bonus-heading-actions">
              {isAdmin && <a className="bonus-admin-link" href="/admin">Manage bonuses <Icon name="arrow" size={15} /></a>}
              <button className={`bonus-search-toggle ${bonusSearchOpen ? "is-open" : ""}`} onClick={() => { setBonusSearchOpen((open) => !open); setBonusSearch(""); }} aria-label={bonusSearchOpen ? "Close search" : "Search bonuses"}><Icon name={bonusSearchOpen ? "close" : "search"} size={23} /></button>
            </div>
          </div>
          {bonusSearchOpen && <label className="bonus-search-field"><Icon name="search" size={17} /><input autoFocus value={bonusSearch} onChange={(event) => setBonusSearch(event.target.value)} placeholder="Search guides and trackers..." aria-label="Search bonus resources" /></label>}
          <div className="bonus-tabs" role="tablist" aria-label="Bonus resource type">
            <button className={bonusType === "ebook" ? "selected" : ""} role="tab" aria-selected={bonusType === "ebook"} onClick={() => setBonusType("ebook")}>E-BOOK</button>
            <button className={bonusType === "tracker" ? "selected" : ""} role="tab" aria-selected={bonusType === "tracker"} onClick={() => setBonusType("tracker")}>TRACKER</button>
          </div>
          <section className="bonus-resource-list" aria-label={bonusType === "ebook" ? "E-book downloads" : "Tracker downloads"}>
            {visibleUploadedResources.map((resource) => <article className="bonus-resource-card" key={resource.id}>
              <div className={`bonus-cover ${bonusType}`} style={{ backgroundImage: `linear-gradient(180deg,rgba(5,13,22,.02),rgba(6,13,23,.34)),url("${resource.image_url}")` }}>
                <span className="bonus-cover-brand">✦ JOOLO</span>
                <span className="bonus-cover-title">{resource.title}</span>
                <span className="bonus-file-badge">{bonusType === "ebook" ? "PDF" : "XLSX"}</span>
              </div>
              <div className="bonus-resource-info">
                <span className="bonus-category">{bonusType === "ebook" ? "E-BOOK" : "TRACKER"}</span>
                <h2>{resource.title}</h2>
                <p>{resource.description}</p>
                <span className="bonus-resource-meta">{bonusType === "ebook" ? "PDF · Google Drive" : "Excel · Google Drive"}</span>
                <a className="bonus-download-button" href={resource.download_url} target="_blank" rel="noreferrer">
                  DOWNLOAD {bonusType === "ebook" ? "PDF" : "EXCEL"} <Icon name="arrow" size={16} />
                </a>
              </div>
            </article>)}
            {visibleBonusResources.map((resource) => <article className="bonus-resource-card" key={resource.title}>
              <div className={`bonus-cover ${bonusType}`} style={{ backgroundImage: `linear-gradient(180deg,rgba(5,13,22,.02),rgba(6,13,23,.34)),url("https://images.unsplash.com/${resource.image}?auto=format&fit=crop&w=650&h=460&q=82")` }}>
                <span className="bonus-cover-brand">✦ JOOLO</span>
                <span className="bonus-cover-title">{resource.title}</span>
                {bonusType === "tracker" && <span className="bonus-file-badge">XLSX</span>}
              </div>
              <div className="bonus-resource-info"><span className="bonus-category">{resource.category}</span><h2>{resource.title}</h2><p>{resource.description}</p><span className="bonus-resource-meta">{resource.detail}</span><button className="bonus-download-button" onClick={() => { void downloadBonus(resource, bonusType).catch((error: unknown) => { console.error("Unable to create bonus download", error); notify("Download couldn’t be created. Please try again."); }); }}>{bonusType === "ebook" ? "DOWNLOAD PDF" : "DOWNLOAD XLSX"} <Icon name="arrow" size={16} /></button></div>
            </article>)}
            {visibleBonusResources.length + visibleUploadedResources.length === 0 && <div className="bonus-empty"><Icon name="search" size={23} /><strong>No resources found in this orbit.</strong><span>Try a different title or category.</span><button onClick={() => setBonusSearch("")}>Clear search</button></div>}
          </section>
          <footer className="bonus-footer"><span>✦ Made for your becoming</span><button onClick={() => setBonusOpen(false)}>Back to your journey ↑</button></footer>
        </main>
      </div>}

      {leaderboardOpen && <div className="leaderboard-screen">
        <div className="stars stars-one" /><div className="stars stars-two" />
        <header className="topbar shell leaderboard-topbar">
          <a href="#top" className="brand" onClick={(event) => { event.preventDefault(); setLeaderboardOpen(false); }} aria-label="JOolo home"><span className="brand-mark">✦</span><span>JO<span className="brand-muted">O</span>LO<span className="brand-dot">.</span></span></a>
          <nav className="main-nav" aria-label="Main navigation">
            <button className="nav-link active leaderboard-nav-active" onClick={() => setLeaderboardOpen(false)}>Leaderboard</button>
            <button className="nav-link" onClick={() => { setLeaderboardOpen(false); jumpToChallenges(); }}>Challenge</button>
            <button className="nav-link" onClick={() => { setLeaderboardOpen(false); setBonusOpen(true); }}>Bonus</button>
          </nav>
          <div className="header-actions"><button className="icon-button" onClick={() => notify("Language: English")} aria-label="Language"><Icon name="globe" size={19} /></button><button className="icon-button" onClick={openProfile} aria-label="Profile"><Icon name="user" size={21} /></button></div>
        </header>
        <main className="leaderboard-content shell" aria-labelledby="leaderboard-title">
          <div className="leaderboard-heading"><span className="eyebrow"><span className="eyebrow-line" /> THE COSMIC COMMUNITY</span><h1 id="leaderboard-title">Find your <span>orbit.</span></h1><p>Every small step deserves a little stardust.</p></div>
          <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard period">
            {(["daily", "weekly", "phase"] as const).map((period) => <button key={period} className={leaderboardPeriod === period ? "selected" : ""} role="tab" aria-selected={leaderboardPeriod === period} onClick={() => { setLeaderboardPeriod(period); setLeaderboardPage(0); }}>{period}</button>)}
          </div>
          {leaderboardPeriod === "phase" ? <section className="phase-progress-dashboard" aria-label="40-day progress dashboard">
            <div className="phase-progress-heading">
              <div>
                <span className="eyebrow"><span className="eyebrow-line" /> YOUR 40-DAY JOURNEY</span>
                <h2>Progress <span>in orbit.</span></h2>
                <p>Track your daily stardust and compare it with today’s Daily leaderboard leaders.</p>
              </div>
              <div className="phase-progress-stats">
                <div><span>STARDUST EARNED</span><strong>✦ {userTotalRecordedStardust.toLocaleString()}</strong></div>
                <div><span>DAY {selectedDay} SCORE</span><strong>✦ {(dailyStardustByDay[String(selectedDay)] ?? 0).toLocaleString()}</strong></div>
              </div>
            </div>
            <div className="progress-chart-panel">
              <div className="progress-chart-topline">
                <div><span className="chart-kicker">DAILY STARDUST</span><h3>Day-by-day progress</h3></div>
                <span className="chart-unit">STARDUST / DAY</span>
              </div>
              <div className="progress-chart-scroll">
                <svg className="progress-chart" viewBox="0 0 930 345" role="img" aria-labelledby="progress-chart-title progress-chart-description">
                  <title id="progress-chart-title">Daily stardust progress over 40 challenge days</title>
                  <desc id="progress-chart-description">Your recorded daily stardust is shown with a cyan line. Gold, pink, and purple horizontal lines show current daily benchmark scores for the top three leaderboard players.</desc>
                  {Array.from({ length: 6 }, (_, index) => {
                    const score = Math.round((chartYMax / 5) * (5 - index));
                    const y = chartBounds.top + (chartBounds.height / 5) * index;
                    return <g key={`y-${score}`}>
                      <line className="chart-grid-line" x1={chartBounds.left} x2={chartBounds.left + chartBounds.width} y1={y} y2={y} />
                      <text className="chart-axis-label" x={chartBounds.left - 12} y={y + 4} textAnchor="end">{score.toLocaleString()}</text>
                    </g>;
                  })}
                  {[1, 5, 10, 15, 20, 25, 30, 35, 40].map((day) => <g key={`x-${day}`}>
                    <line className="chart-x-tick" x1={chartX(day)} x2={chartX(day)} y1={chartBounds.top + chartBounds.height} y2={chartBounds.top + chartBounds.height + 5} />
                    <text className="chart-axis-label" x={chartX(day)} y={chartBounds.top + chartBounds.height + 23} textAnchor="middle">Day {day}</text>
                  </g>)}
                  <line className="chart-axis-line" x1={chartBounds.left} x2={chartBounds.left} y1={chartBounds.top} y2={chartBounds.top + chartBounds.height} />
                  <line className="chart-axis-line" x1={chartBounds.left} x2={chartBounds.left + chartBounds.width} y1={chartBounds.top + chartBounds.height} y2={chartBounds.top + chartBounds.height} />
                  {dailyLeaders.map((leader, index) => {
                    const colorClass = `leader-benchmark-${index + 1}`;
                    const y = chartY(leader.daily);
                    return <g className={colorClass} key={leader.handle}>
                      <line className="leader-benchmark-line" x1={chartBounds.left} x2={chartBounds.left + chartBounds.width} y1={y} y2={y} />
                      <circle className="leader-benchmark-dot" cx={chartBounds.left + chartBounds.width} cy={y} r="4" />
                    </g>;
                  })}
                  {userTrendSegments.map((segment, index) => <polyline
                    className="user-progress-line"
                    key={`user-line-${index}`}
                    points={segment.map((point) => `${chartX(point.day)},${chartY(point.score)}`).join(" ")}
                  />)}
                  {userRecordedPoints.map((point) => <circle className="user-progress-point" key={`user-point-${point.day}`} cx={chartX(point.day)} cy={chartY(point.score)} r="5">
                    <title>{`Day ${point.day}: ${point.score} stardust earned`}</title>
                  </circle>)}
                </svg>
              </div>
              <div className="chart-legend" aria-label="Chart lines">
                <span className="chart-legend-item chart-user-legend"><i /> You · daily stardust</span>
                {dailyLeaders.map((leader, index) => <span className={`chart-legend-item chart-leader-legend leader-benchmark-${index + 1}`} key={leader.handle}>
                  <i /> #{index + 1} {leader.handle} · {leader.daily.toLocaleString()} benchmark
                </span>)}
              </div>
              <p className="chart-data-note">Your line records stardust from quests you complete from now on; unrecorded days are left blank. Leader lines are today’s Daily scores used as comparison benchmarks, not historical records.</p>
            </div>
          </section> : <>
            <section className="podium" aria-label="Top three players">
              {[{ leader: topLeaders[1], rank: 2 }, { leader: topLeaders[0], rank: 1 }, { leader: topLeaders[2], rank: 3 }].map(({ leader, rank }) => <article className={`podium-player podium-${rank}`} key={leader.handle}>
                <div className="podium-rank">{rank === 1 && <span className="crown">♛</span>}{rank}</div>
                <div className="podium-avatar-wrap"><img src={`https://images.unsplash.com/${leader.avatar}?auto=format&fit=crop&w=240&h=240&q=80`} alt="" className="podium-avatar" /><span className="avatar-glow" /></div>
                <strong>{leader.handle}</strong><span className="podium-title">{leader.title}</span>
                <div className="podium-score"><span className="leader-coin">✦</span>{leader[leaderboardPeriod].toLocaleString()}</div>
              </article>)}
            </section>
            <section className="leader-list" aria-label="Leaderboard ranks">
              {pageLeaders.map((leader, index) => {
                const rank = index + 4 + leaderboardPage * 7;
                const isYou = leader.handle === "@you";
                return <article className={`leader-list-row ${isYou ? "you" : ""}`} key={leader.handle}>
                  <span className="list-rank">{rank}</span>
                  <img className="list-avatar" src={`https://images.unsplash.com/${leader.avatar}?auto=format&fit=crop&w=100&h=100&q=75`} alt="" />
                  <span className="list-player">{leader.handle}<small>{isYou ? "Your cosmic journey" : leader.title}</small></span>
                  <span className="list-score"><span className="leader-coin">✦</span><b>{leader[leaderboardPeriod].toLocaleString()}</b></span>
                </article>;
              })}
            </section>
            <div className="leaderboard-pagination">
              {leaderboardPage > 0 && <button className="page-button previous" onClick={() => setLeaderboardPage((page) => Math.max(0, page - 1))}><Icon name="arrow" size={17} /> PREVIOUS</button>}
              <span>PAGE {leaderboardPage + 1} <i /> 2</span>
              {leaderboardPage === 0 && <button className="page-button" onClick={() => setLeaderboardPage(1)}>NEXT <Icon name="arrow" size={17} /></button>}
              {leaderboardPage === 1 && <button className="page-button" onClick={() => { setLeaderboardOpen(false); jumpToChallenges(); }}>BACK TO QUESTS <Icon name="arrow" size={17} /></button>}
            </div>
          </>}
        </main>
      </div>}
      {journeyDatePickerOpen && <div className="modal-backdrop start-date-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setJourneyDatePickerOpen(false); }}>
        <section className="modal glass-panel start-date-dialog" role="dialog" aria-modal="true" aria-labelledby="start-date-title">
          <button className="modal-close" type="button" onClick={() => setJourneyDatePickerOpen(false)} aria-label="Close date picker"><Icon name="close" size={19} /></button>
          <div className="modal-icon"><Icon name="calendar" size={25} /></div>
          <span className="eyebrow">YOUR 40-DAY CHALLENGE</span>
          <h2 id="start-date-title">Input your challenge start date.</h2>
          <p>Tanggal ini tersimpan di akun Supabase dan menandai hari pertama challenge 40 hari Anda.</p>
          <form onSubmit={saveJourneyStartDate}>
            <label htmlFor="journey-start-date">CHALLENGE START DATE</label>
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
              <button className="outline-button" type="button" onClick={() => setJourneyDatePickerOpen(false)} disabled={journeyDateSaving}>Cancel</button>
              <button className="primary-button" type="submit" disabled={journeyDateSaving}>{journeyDateSaving ? "Saving..." : "Save start date"} <Icon name="check" size={16} /></button>
            </div>
          </form>
        </section>
      </div>}
      {toast && <div className="toast" role="status"><span>✦</span>{toast}</div>}
    </main>
  );
}
