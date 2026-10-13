"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthFormProps = { mode: "login" | "signup" };
type SignupGender = "woman" | "man";

const signupAvatars: Record<SignupGender, Array<{ name: string; src: string }>> = {
  woman: [
    { name: "Luna", src: "/AVATAR/Woman/Luna.png" },
    { name: "Rosie", src: "/AVATAR/Woman/Rosie.png" },
    { name: "Stella", src: "/AVATAR/Woman/Stella.png" },
    { name: "Aurora", src: "/AVATAR/Woman/Aurora.png" },
  ],
  man: [
    { name: "Ray", src: "/AVATAR/Man/Ray.png" },
    { name: "Atlas", src: "/AVATAR/Man/Atlas.png" },
    { name: "Finn", src: "/AVATAR/Man/Finn.png" },
    { name: "Cosmo", src: "/AVATAR/Man/Cosmo.png" },
  ],
};

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [gender, setGender] = useState<SignupGender | "">("");
  const [avatarUrl, setAvatarUrl] = useState("");
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
        const genderValue = String(form.get("gender") ?? "");
        const selectedGender = genderValue === "woman" || genderValue === "man" ? genderValue : null;
        const ageRange = String(form.get("ageRange") ?? "");
        if (
          !selectedGender
          || !["<18", "18-25", ">25"].includes(ageRange)
          || !signupAvatars[selectedGender].some((avatar) => avatar.src === avatarUrl)
        ) {
          setMessage("Please select a gender, avatar, and age range.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, gender: selectedGender, age_range: ageRange, avatar_url: avatarUrl },
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
            <label htmlFor="auth-gender">GENDER</label>
            <select id="auth-gender" name="gender" value={gender} onChange={(event) => {
              const value = event.currentTarget.value;
              setGender(value === "woman" || value === "man" ? value : "");
              setAvatarUrl("");
            }} required>
              <option value="" disabled>Select gender</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
            </select>
            {gender && <fieldset className="signup-avatar-fieldset">
              <legend>CHOOSE YOUR AVATAR</legend>
              <div className="signup-avatar-options">
                {signupAvatars[gender].map((avatar) => (
                  <button
                    className={`signup-avatar-option ${avatarUrl === avatar.src ? "selected" : ""}`}
                    type="button"
                    key={avatar.src}
                    aria-label={`Choose ${avatar.name} as your profile avatar`}
                    aria-pressed={avatarUrl === avatar.src}
                    onClick={() => setAvatarUrl(avatar.src)}
                  >
                    <Image src={avatar.src} alt="" loading="lazy" decoding="async" width={128} height={128} sizes="(max-width: 560px) 22vw, 100px" />
                    <span>{avatar.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>}
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
          {isSignup ? "Already have an account? " : "New to JOolo? "}
          <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create account"}</Link>
        </p>
        <div className="login-footer"><span>✦</span> Small steps. Stellar progress.</div>
      </section>
    </main>
  );
}
