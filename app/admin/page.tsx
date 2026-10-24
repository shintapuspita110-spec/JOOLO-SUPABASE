import { redirect } from "next/navigation";
import AdminClient, { type AdminCoinTestUser } from "@/app/admin/admin-client";
import { createClient } from "@/lib/supabase/server";
import type { UploadedBonusResource } from "@/lib/bonus";
import type { PhaseDailyQuest } from "@/lib/phase-quests";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError && userError.name !== "AuthSessionMissingError") {
    throw new Error(`Could not verify your Supabase session: ${userError.message}`);
  }
  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not verify your admin role: ${profileError.message}`);
  }
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const phaseDailyQuests: PhaseDailyQuest[] = [];
  const phaseQuestPageSize = 1000;
  for (let from = 0; ; from += phaseQuestPageSize) {
    const { data, error } = await supabase
      .from("phase_daily_quests")
      .select("id, phase_category_id, phase_name, day_number, focus, cover_image, task_name, short_description, frequency, level, target, total_coin, skill_category_id, soft_skills, max_possible_coin")
      .order("phase_category_id", { ascending: true })
      .order("day_number", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + phaseQuestPageSize - 1);

    if (error) {
      throw new Error(`Could not load phase daily challenges: ${error.message}`);
    }
    phaseDailyQuests.push(...(data ?? []) as PhaseDailyQuest[]);
    if (!data || data.length < phaseQuestPageSize) break;
  }

  const { data: resources, error: resourcesError } = await supabase
    .from("bonus_resources")
    .select("id, type, title, description, image_url, download_url, created_at")
    .order("created_at", { ascending: false });

  if (resourcesError) {
    throw new Error(`Could not load bonus resources: ${resourcesError.message}`);
  }

  const { data: coinTestUsers, error: coinTestUsersError } = await supabase.rpc("get_coin_leaderboard_test_users");
  if (coinTestUsersError) {
    throw new Error(`Could not load leaderboard test users: ${coinTestUsersError.message}`);
  }

  return (
    <AdminClient
      userId={user.id}
      initialPhaseDailyQuests={phaseDailyQuests}
      initialResources={(resources ?? []) as UploadedBonusResource[]}
      initialCoinTestUsers={(coinTestUsers ?? []) as AdminCoinTestUser[]}
    />
  );
}
