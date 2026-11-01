import { redirect } from "next/navigation";
import AccessCodeOnboarding from "@/app/onboarding/access-code/access-code-onboarding";
import { createClient } from "@/lib/supabase/server";

export default async function AccessCodeOnboardingPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError && userError.name !== "AuthSessionMissingError") {
    throw new Error(`Could not verify your Supabase session: ${userError.message}`);
  }
  if (!user) {
    redirect("/login");
  }

  const { data: hasClaimedAccessCode, error: accessCodeError } = await supabase.rpc("has_claimed_access_code");
  if (accessCodeError) {
    throw new Error(`Could not verify your access-code claim: ${accessCodeError.message}`);
  }
  if (hasClaimedAccessCode === true) {
    redirect("/dashboard");
  }

  return <AccessCodeOnboarding />;
}
