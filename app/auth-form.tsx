"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-messages";
import { signupAvatars } from "@/lib/signup-avatars";

type AuthFormProps = { mode: "login" | "signup"; initialMessage?: string };
type SignupGender = keyof typeof signupAvatars;

export default function AuthForm({ mode, initialMessage = "" }: AuthFormProps) {
  const isSignup = mode === "signup";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [gender, setGender] = useState<SignupGender | "">("");
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    const loginError = new URLSearchParams(window.location.search).get("error");
    if (loginError) {
      setMessage(getAuthErrorMessage(loginError));
      return;
    }
    if (initialMessage) return;
    if (!configured) return;
    let mounted = true;
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (data.user) {
        window.location.replace("/dashboard");
      } else if (error && error.name !== "AuthSessionMissingError") {
        setMessage(error.message);
      }
    }).catch((error: unknown) => {
      if (mounted) {
        setMessage(error instanceof Error ? error.message : "Tidak dapat memverifikasi sesi login.");
      }
    });

    return () => {
      mounted = false;
    };
  }, [configured, initialMessage]);

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
      if (isSignup) {
        const fullName = String(form.get("fullName") ?? "").trim();
        const genderValue = String(form.get("gender") ?? "");
        const selectedGender = genderValue === "woman" || genderValue === "man" ? genderValue : null;
        const ageRange = String(form.get("ageRange") ?? "");
        const selectedAvatarUrl = String(
          form.get("avatarUrl") ?? (selectedGender ? signupAvatars[selectedGender][0].src : ""),
        );
        if (
          !selectedGender
          || !["<18", "18-25", ">25"].includes(ageRange)
          || !signupAvatars[selectedGender].some((avatar) => avatar.src === selectedAvatarUrl)
        ) {
          setMessage("Please select a gender, avatar, and age range.");
          return;
        }
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            fullName,
            gender: selectedGender,
            ageRange,
            avatarUrl: selectedAvatarUrl,
          }),
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (
          typeof result !== "object"
          || result === null
          || !("created" in result)
          || result.created !== true
        ) {
          const errorMessage = typeof result === "object" && result !== null && "error" in result
            && typeof result.error === "string"
            ? result.error
            : "Pendaftaran belum berhasil. Silakan periksa data dan coba lagi.";
          setMessage(errorMessage);
        } else if (!response.ok) {
          setMessage("Pendaftaran belum berhasil. Silakan periksa data dan coba lagi.");
        } else if ("requiresEmailConfirmation" in result && result.requiresEmailConfirmation === true) {
          setMessage("Akun berhasil dibuat. Periksa email untuk konfirmasi sebelum login.");
        } else {
          window.location.assign("/onboarding/access-code");
        }
      } else {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (
          typeof result !== "object"
          || result === null
          || !("authenticated" in result)
          || result.authenticated !== true
        ) {
          const errorMessage = typeof result === "object" && result !== null && "error" in result
            && typeof result.error === "string"
            ? result.error
            : "Login belum berhasil. Silakan coba lagi.";
          setMessage(errorMessage);
        } else if (!response.ok) {
          setMessage("Login belum berhasil. Silakan coba lagi.");
        } else {
          window.location.assign("/dashboard");
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
        <Link href="/" className="brand login-brand" aria-label="JOOLO">
          <Image className="brand-logo" src="/joolo-logo.png" width={566} height={161} alt="" />
        </Link>
        <div className="login-orbit" aria-hidden="true"><span>✦</span><i /></div>
        <div className="eyebrow login-eyebrow"><span className="eyebrow-line" /> YOUR NEXT CHAPTER STARTS HERE</div>
        <h1 id="auth-title">{isSignup ? <>Create your <span>account.</span></> : <>Your journey<br />starts <span>within.</span></>}</h1>
        <p className="login-copy">{isSignup ? "Create an account to save your journey and get started." : "Log in to continue your 40-day cosmic growth journey."}</p>
        {!configured && <p className="auth-message" role="status">Supabase belum dikonfigurasi. Salin .env.example ke .env.local dan isi URL serta publishable/anon key proyek Supabase.</p>}
        <form
          className="login-form"
          method="post"
          action={isSignup ? "/api/auth/signup" : "/api/auth/login"}
          onSubmit={submit}
        >
          {isSignup && <>
            <label htmlFor="auth-name">FULL NAME</label>
            <input id="auth-name" name="fullName" type="text" autoComplete="name" placeholder="Your name" maxLength={60} required />
            <label htmlFor="auth-gender">GENDER</label>
            <select id="auth-gender" name="gender" value={gender} onChange={(event) => {
              const value = event.currentTarget.value;
              setGender(value === "woman" || value === "man" ? value : "");
            }} required>
              <option value="" disabled>Select gender</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
            </select>
            <fieldset className="signup-avatar-fieldset">
              <legend>CHOOSE YOUR AVATAR</legend>
              <p className="signup-avatar-hint">Pilih avatar yang sesuai dengan gender.</p>
              {Object.entries(signupAvatars).map(([avatarGender, avatars]) => (
                <div className="signup-avatar-group" key={avatarGender}>
                  <p className="signup-avatar-group-title">{avatarGender === "woman" ? "Woman" : "Man"}</p>
                  <div className="signup-avatar-options">
                    {avatars.map((avatar) => (
                      <label className="signup-avatar-option" key={avatar.src}>
                        <input
                          className="signup-avatar-radio"
                          type="radio"
                          name="avatarUrl"
                          value={avatar.src}
                          required
                        />
                        <Image src={avatar.src} alt="" loading="lazy" decoding="async" width={128} height={128} sizes="(max-width: 560px) 22vw, 100px" />
                        <span>{avatar.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <label htmlFor="auth-age-range">AGE</label>
            <select id="auth-age-range" name="ageRange" defaultValue="" required>
              <option value="" disabled>Select age range</option>
              <option value="&lt;18">&lt;18</option>
              <option value="18-25">18-25</option>
              <option value="&gt;25">&gt;25</option>
            </select>
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
          {isSignup ? "Already have an account? " : "New to JOOLO? "}
          <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create account"}</Link>
        </p>
        <div className="login-footer"><span>✦</span> Small steps. Stellar progress.</div>
      </section>
    </main>
  );
}
