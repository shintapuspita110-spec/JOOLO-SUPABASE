"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AccessCodeOnboarding() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function claimAccessCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setBusy(true);

    const formData = new FormData(event.currentTarget);
    const code = String(formData.get("accessCode") ?? "").trim().toUpperCase();

    try {
      const { data, error } = await createClient().rpc("claim_access_code", { p_code: code });
      if (error) throw new Error(error.message);
      if (data !== true) throw new Error("Kode akses belum berhasil diklaim. Silakan coba lagi.");

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Unable to claim JOOLO access code", error);
      setErrorMessage(error instanceof Error ? error.message : "Terjadi kesalahan saat mengklaim kode akses.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="cosmos login-screen onboarding-screen">
      <div className="stars stars-one" />
      <div className="stars stars-two" />
      <div className="nebula nebula-left" />
      <div className="nebula nebula-right" />
      <section className="login-card onboarding-card access-code-card" aria-labelledby="access-code-title">
        <Link href="/" className="brand login-brand" aria-label="JOOLO">
          <Image className="brand-logo" src="/joolo-logo.png" width={566} height={161} alt="" />
        </Link>
        <div className="login-orbit" aria-hidden="true"><span>✦</span><i /></div>
        <div className="eyebrow login-eyebrow"><span className="eyebrow-line" /> YOUR JOOLO JOURNEY</div>
        <h1 id="access-code-title">Hi pelanggan yang <span>terhormat!</span></h1>
        <div className="access-code-welcome">
          <p>Kami ucapkan terima kasih karena sudah bergabung dengan layanan kami.</p>
          <p>Silahkan masukkan KODE AKSES JOOLO yang kami kirimkan melalui email.</p>
          <p>
            Jika ada saran dan masukan atau terjadi kendala silahkan hubungi WA{" "}
            <a href="https://wa.me/6287893951233" target="_blank" rel="noreferrer">wa.me/6287893951233</a> (admin JOOLO)
          </p>
          <p>Salam hangat<br />Tim JOOLO</p>
        </div>
        <form className="onboarding-form access-code-form" onSubmit={(event) => { void claimAccessCode(event); }}>
          <label htmlFor="access-code">KODE AKSES JOOLO</label>
          <input
            id="access-code"
            name="accessCode"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            pattern="[A-HJ-NP-Za-hj-np-z2-9]{16,32}"
            placeholder="Masukkan kode akses"
            aria-describedby={errorMessage ? "access-code-error" : undefined}
            required
          />
          {errorMessage && <p id="access-code-error" className="auth-message" role="alert">{errorMessage}</p>}
          <button className="login-submit onboarding-submit" type="submit" disabled={busy}>
            {busy ? "PLEASE WAIT..." : "START ACTION"}
          </button>
        </form>
      </section>
    </main>
  );
}
