import { redirect } from "next/navigation";
import AdminClient, { type AdminCoinTestUser } from "@/app/admin/admin-client";
import { createClient } from "@/lib/supabase/server";
import type { UploadedBonusResource } from "@/lib/bonus";

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
      initialResources={(resources ?? []) as UploadedBonusResource[]}
      initialCoinTestUsers={(coinTestUsers ?? []) as AdminCoinTestUser[]}
    />
  );
}
