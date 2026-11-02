import AuthForm from "@/app/auth-form";
import { getAuthErrorMessage } from "@/lib/auth-messages";

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const initialMessage = typeof error === "string" ? getAuthErrorMessage(error) : "";

  return <AuthForm mode="login" initialMessage={initialMessage} />;
}
