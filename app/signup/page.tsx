import AuthForm from "@/app/auth-form";
import { getAuthErrorMessage } from "@/lib/auth-messages";

type SignupPageProps = {
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error, notice } = await searchParams;
  const status = typeof error === "string" ? error : typeof notice === "string" ? notice : "";
  const initialMessage = status ? getAuthErrorMessage(status) : "";

  return <AuthForm mode="signup" initialMessage={initialMessage} />;
}
