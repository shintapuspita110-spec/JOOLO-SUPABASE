"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthFormProps = { mode: "login" | "signup" };

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get("error");
    if (callbackError) setMessage(callbackError);
    if (!configured) return;
    let mounted = true;
    const supabase = createClient();

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setMessage(error.message);
      } else if (data.session) {
        router.replace("/dashboard");
      }
    });

    return () => {
      mounted = false;
    };
  }, [configured, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!configured) {
      setMessage("Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    setBusy(true);
    try {
      const supabase = createClient();
      if (isSignup) {
        const fullName = String(form.get("fullName") ?? "").trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });

        if (error) {
          setMessage(error.message);
        } else if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setMessage("Akun berhasil dibuat. Periksa email untuk konfirmasi sebelum login.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage(error.message);
        } else {
          router.replace("/dashboard");
          router.refresh();
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan saat menghubungi Supabase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="cosmos login-screen">
      <div className="stars stars-one" />
      <div className="stars stars-two" />
      <div className="nebula nebula-left" />
      <div className="nebula nebula-right" />
      <section className="login-card" aria-labelledby="auth-title">
        <Link href="/" className="brand login-brand" aria-label="JOolo">
          <span className="brand-mark">✦</span>
          <span>JO<span className="brand-muted">O</span>LO<span className="brand-dot">.</span></span>
        </Link>
        <div className="login-orbit" aria-hidden="true"><span>✦</span><i /></div>
        <div className="eyebrow login-eyebrow"><span className="eyebrow-line" /> YOUR NEXT CHAPTER STARTS HERE</div>
        <h1 id="auth-title">{isSignup ? <>Create your <span>account.</span></> : <>Your journey<br />starts <span>within.</span></>}</h1>
        <p className="login-copy">{isSignup ? "Create an account to save your journey and get started." : "Log in to continue your 40-day cosmic growth journey."}</p>
        {!configured && <p className="auth-message" role="status">Supabase belum dikonfigurasi. Salin .env.example ke .env.local dan isi URL serta publishable/anon key proyek Supabase.</p>}
        <form className="login-form" onSubmit={submit}>
          {isSignup && <>
            <label htmlFor="auth-name">FULL NAME</label>
            <input id="auth-name" name="fullName" type="text" autoComplete="name" placeholder="Your name" maxLength={60} required />
          </>}
          <label htmlFor="auth-email">EMAIL ADDRESS</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          <label htmlFor="auth-password">PASSWORD</label>
          <input id="auth-password" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "At least 8 characters" : "Your password"} minLength={isSignup ? 8 : undefined} required />
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="login-submit" type="submit" disabled={busy || !configured}>
            {busy ? "PLEASE WAIT..." : isSignup ? "CREATE ACCOUNT" : "LOG IN"}
          </button>
        </form>
        <p className="auth-switch">
          {isSignup ? "Already have an account? " : "New to JOolo? "}
          <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create account"}</Link>
        </p>
        <div className="login-footer"><span>✦</span> Small steps. Stellar progress.</div>
      </section>
    </main>
  );
}
