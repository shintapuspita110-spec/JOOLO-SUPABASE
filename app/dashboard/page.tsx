import { redirect } from "next/navigation";
import DashboardClient from "@/app/dashboard/dashboard-client";
import { createClient } from "@/lib/supabase/server";
import type { UploadedBonusResource } from "@/lib/bonus";
import type { PhaseDailyQuest, PhaseQuestProgress } from "@/lib/phase-quests";
import type { UserDailyQuest } from "@/lib/user-daily-quests";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError && userError.name !== "AuthSessionMissingError") {
    throw new Error(`Could not verify your Supabase session: ${userError.message}`);
  }
  if (!user) {
    redirect("/login");
  }

  const { data: challengeSettings, error: challengeSettingsError } = await supabase
    .from("challenge_settings")
    .select("start_date")
    .eq("user_id", user.id)
    .maybeSingle();

  if (challengeSettingsError) {
    throw new Error(`Could not load your challenge start date: ${challengeSettingsError.message}`);
  }

  let challengeStartDate = challengeSettings?.start_date;
  if (!challengeStartDate) {
    const { data: createdSettings, error: createSettingsError } = await supabase
      .from("challenge_settings")
      .insert({ user_id: user.id })
      .select("start_date")
      .single();

    if (createSettingsError) {
      throw new Error(`Could not initialize your challenge start date: ${createSettingsError.message}`);
    }
    challengeStartDate = createdSettings.start_date;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not load your profile: ${profileError.message}`);
  }

  const { data: bonusResources, error: bonusResourcesError } = await supabase
    .from("bonus_resources")
    .select("id, type, title, description, image_url, download_url, created_at")
    .order("created_at", { ascending: false });

  if (bonusResourcesError) {
    throw new Error(`Could not load bonus resources: ${bonusResourcesError.message}`);
  }

  const { data: phaseDailyQuests, error: phaseDailyQuestsError } = await supabase
    .from("phase_daily_quests")
    .select("id, phase_category_id, phase_name, day_number, focus, cover_image, task_name, short_description, frequency, level, target, total_coin, skill_category_id, soft_skills, max_possible_coin")
    .gte("day_number", 1)
    .lte("day_number", 40)
    .order("day_number", { ascending: true })
    .order("id", { ascending: true });

  if (phaseDailyQuestsError) {
    throw new Error(`Could not load phase daily quests: ${phaseDailyQuestsError.message}`);
  }

  const { data: phaseQuestProgress, error: phaseQuestProgressError } = await supabase
    .from("user_phase_quest_progress")
    .select("quest_id, achieved_amount, earned_coin, progress_updated, completed_at")
    .eq("user_id", user.id);

  if (phaseQuestProgressError) {
    throw new Error(`Could not load your phase quest progress: ${phaseQuestProgressError.message}`);
  }

  const { data: userDailyQuests, error: userDailyQuestsError } = await supabase
    .from("user_daily_quests")
    .select("id, user_id, task_name, short_description, start_date, end_date, frequency, level, total_coin, target_amount, target_unit, achieved_amount, is_completed, earned_coin")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (userDailyQuestsError) {
    throw new Error(`Could not load your custom daily quests: ${userDailyQuestsError.message}`);
  }

  const metadataName = user.user_metadata.full_name;

  return (
    <DashboardClient
      userId={user.id}
      email={profile?.email ?? user.email ?? ""}
      name={profile?.full_name || (typeof metadataName === "string" ? metadataName : "") || user.email?.split("@")[0] || "JOolo member"}
      isAdmin={profile?.role === "admin"}
      uploadedResources={(bonusResources ?? []) as UploadedBonusResource[]}
      initialStartDate={challengeStartDate}
      phaseDailyQuests={(phaseDailyQuests ?? []) as PhaseDailyQuest[]}
      phaseQuestProgress={(phaseQuestProgress ?? []) as PhaseQuestProgress[]}
      userDailyQuests={(userDailyQuests ?? []) as UserDailyQuest[]}
    />
  );
}
