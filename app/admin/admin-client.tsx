"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { UploadedBonusResource, BonusType } from "@/lib/bonus";

function getGoogleDriveImageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return null;

    const fileId = url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get("id");
    if (!fileId || !/^[A-Za-z0-9_-]+$/.test(fileId)) return null;

    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1200`;
  } catch {
    return null;
  }
}

export type AdminCoinTestUser = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  gender: "woman" | "man";
  daily_coin: number;
  weekly_coin: number;
};

type CoinTestUserDraft = {
  userId: string;
  displayName: string;
  gender: "woman" | "man";
  dailyCoin: string;
  weeklyCoin: string;
};

const newCoinTestUserDraft: CoinTestUserDraft = {
  userId: "",
  displayName: "",
  gender: "woman",
  dailyCoin: "140",
  weeklyCoin: "980",
};

export default function AdminClient({
  userId,
  initialResources,
  initialCoinTestUsers,
}: {
  userId: string;
  initialResources: UploadedBonusResource[];
  initialCoinTestUsers: AdminCoinTestUser[];
}) {
  const [resources, setResources] = useState(initialResources);
  const [coinTestUsers, setCoinTestUsers] = useState(initialCoinTestUsers);
  const [coinTestUserDraft, setCoinTestUserDraft] = useState(newCoinTestUserDraft);
  const [coinTestUserSearch, setCoinTestUserSearch] = useState("");
  const [coinTestUserGenderFilter, setCoinTestUserGenderFilter] = useState<"all" | "woman" | "man">("all");
  const [coinTestUserSort, setCoinTestUserSort] = useState<"name" | "daily" | "weekly">("name");
  const [busy, setBusy] = useState(false);
  const [coinTestUsersBusy, setCoinTestUsersBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [coinTestUsersMessage, setCoinTestUsersMessage] = useState("");
  const [coinTestUsersError, setCoinTestUsersError] = useState("");
  const coinTestUserFormRef = useRef<HTMLFormElement>(null);
  const coinTestUserNameInputRef = useRef<HTMLInputElement>(null);
  const visibleCoinTestUsers = useMemo(() => {
    const search = coinTestUserSearch.trim().toLocaleLowerCase("id-ID");
    return coinTestUsers
      .filter((testUser) =>
        testUser.display_name.toLocaleLowerCase("id-ID").includes(search)
        && (coinTestUserGenderFilter === "all" || testUser.gender === coinTestUserGenderFilter))
      .sort((first, second) => {
        if (coinTestUserSort === "daily") return second.daily_coin - first.daily_coin || first.display_name.localeCompare(second.display_name, "id");
        if (coinTestUserSort === "weekly") return second.weekly_coin - first.weekly_coin || first.display_name.localeCompare(second.display_name, "id");
        return first.display_name.localeCompare(second.display_name, "id");
      });
  }, [coinTestUsers, coinTestUserGenderFilter, coinTestUserSearch, coinTestUserSort]);

  async function refreshCoinTestUsers() {
    const { data, error } = await createClient().rpc("get_coin_leaderboard_test_users");
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error("Supabase returned an invalid test-user list");

    const users = data.map((record): AdminCoinTestUser => {
      if (
        typeof record.user_id !== "string"
        || typeof record.display_name !== "string"
        || typeof record.avatar_url !== "string"
        || (record.gender !== "woman" && record.gender !== "man")
        || !Number.isSafeInteger(record.daily_coin)
        || !Number.isSafeInteger(record.weekly_coin)
      ) {
        throw new Error("Supabase returned an invalid test-user record");
      }
      return {
        user_id: record.user_id,
        display_name: record.display_name,
        avatar_url: record.avatar_url,
        gender: record.gender,
        daily_coin: record.daily_coin,
        weekly_coin: record.weekly_coin,
      };
    });
    setCoinTestUsers(users);
  }

  async function shuffleCoinTestUserScores() {
    setCoinTestUsersMessage("");
    setCoinTestUsersError("");
    setCoinTestUsersBusy(true);
    try {
      const { data, error } = await createClient().rpc("shuffle_coin_leaderboard_test_scores");
      if (error) throw new Error(error.message);
      if (!Number.isSafeInteger(data) || Number(data) < 2) {
        throw new Error("Supabase returned an invalid shuffled test-user count");
      }
      await refreshCoinTestUsers();
      setCoinTestUserDraft(newCoinTestUserDraft);
      setCoinTestUsersMessage(
        `Skor Daily dan Weekly berhasil diacak ulang untuk ${Number(data).toLocaleString("id-ID")} pengguna uji.`,
      );
    } catch (error) {
      console.error("Unable to shuffle leaderboard test-user scores", error);
      setCoinTestUsersError(error instanceof Error ? error.message : "Gagal mengacak ulang skor pengguna uji.");
    } finally {
      setCoinTestUsersBusy(false);
    }
  }

  async function saveCoinTestUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCoinTestUsersMessage("");
    setCoinTestUsersError("");

    const dailyCoin = Number(coinTestUserDraft.dailyCoin);
    const weeklyCoin = Number(coinTestUserDraft.weeklyCoin);
    if (
      !coinTestUserDraft.displayName.trim()
      || !Number.isSafeInteger(dailyCoin)
      ||       dailyCoin < 140
      || dailyCoin % 10 !== 0
      || !Number.isSafeInteger(weeklyCoin)
      || weeklyCoin < 980
      || weeklyCoin % 10 !== 0
    ) {
      setCoinTestUsersError("Daily coins minimal 140 dan weekly coins minimal 980, keduanya dalam kelipatan 10.");
      return;
    }

    const isEditing = Boolean(coinTestUserDraft.userId);
    const testUserId = coinTestUserDraft.userId || crypto.randomUUID();
    setCoinTestUsersBusy(true);
    try {
      const { error } = await createClient().rpc("save_coin_leaderboard_test_user", {
        p_user_id: testUserId,
        p_display_name: coinTestUserDraft.displayName.trim(),
        p_gender: coinTestUserDraft.gender,
        p_daily_coin: dailyCoin,
        p_weekly_coin: weeklyCoin,
      });
      if (error) throw new Error(error.message);
      await refreshCoinTestUsers();
      setCoinTestUserDraft(newCoinTestUserDraft);
      setCoinTestUsersMessage(isEditing ? "Pengguna uji berhasil diperbarui." : "Pengguna uji berhasil ditambahkan.");
    } catch (error) {
      console.error("Unable to save leaderboard test user", error);
      setCoinTestUsersError(error instanceof Error ? error.message : "Gagal menyimpan pengguna uji.");
    } finally {
      setCoinTestUsersBusy(false);
    }
  }

  async function deleteCoinTestUser(testUser: AdminCoinTestUser) {
    if (!window.confirm(`Hapus ${testUser.display_name} beserta skor Daily dan Weekly-nya?`)) return;
    setCoinTestUsersMessage("");
    setCoinTestUsersError("");
    setCoinTestUsersBusy(true);
    try {
      const { error } = await createClient().rpc("delete_coin_leaderboard_test_user", {
        p_user_id: testUser.user_id,
      });
      if (error) throw new Error(error.message);
      setCoinTestUsers((users) => users.filter((item) => item.user_id !== testUser.user_id));
      if (coinTestUserDraft.userId === testUser.user_id) setCoinTestUserDraft(newCoinTestUserDraft);
      setCoinTestUsersMessage("Pengguna uji berhasil dihapus.");
    } catch (error) {
      console.error("Unable to delete leaderboard test user", error);
      setCoinTestUsersError(error instanceof Error ? error.message : "Gagal menghapus pengguna uji.");
    } finally {
      setCoinTestUsersBusy(false);
    }
  }

  function editCoinTestUser(testUser: AdminCoinTestUser) {
    setCoinTestUsersMessage("");
    setCoinTestUsersError("");
    setCoinTestUserDraft({
      userId: testUser.user_id,
      displayName: testUser.display_name,
      gender: testUser.gender,
      dailyCoin: String(testUser.daily_coin),
      weeklyCoin: String(testUser.weekly_coin),
    });
    coinTestUserFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.requestAnimationFrame(() => coinTestUserNameInputRef.current?.focus({ preventScroll: true }));
  }

  async function uploadResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    const form = event.currentTarget;
    const values = new FormData(form);
    const type = String(values.get("type")) as BonusType;
    const title = String(values.get("title") ?? "").trim();
    const description = String(values.get("description") ?? "").trim();
    const downloadUrl = String(values.get("downloadUrl") ?? "").trim();
    const coverImageUrl = getGoogleDriveImageUrl(String(values.get("coverUrl") ?? "").trim());

    if (!coverImageUrl) {
      setErrorMessage("Masukkan link gambar Google Drive yang valid (format file/d/ID atau open?id=ID).");
      return;
    }
    try {
      const parsedUrl = new URL(downloadUrl);
      if (parsedUrl.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(parsedUrl.hostname)) {
        setErrorMessage("Gunakan link berbagi Google Drive atau Google Docs yang valid.");
        return;
      }
    } catch {
      setErrorMessage("Masukkan link Google Drive atau Google Docs yang valid.");
      return;
    }

    setBusy(true);

    const supabase = createClient();
    const { data: resource, error: insertError } = await supabase
      .from("bonus_resources")
      .insert({
        type,
        title,
        description,
        image_url: coverImageUrl,
        download_url: downloadUrl,
        created_by: userId,
      })
      .select("id, type, title, description, image_url, download_url, created_at")
      .single();

    if (insertError) {
      setErrorMessage(`Gagal menyimpan resource: ${insertError.message}`);
      setBusy(false);
      return;
    }

    setResources((items) => [resource as UploadedBonusResource, ...items]);
    form.reset();
    setMessage("Resource berhasil disimpan dan sekarang muncul di menu Bonus.");
    setBusy(false);
  }

  async function deleteResource(resource: UploadedBonusResource) {
    if (!window.confirm(`Hapus “${resource.title}” dari menu Bonus?`)) return;
    setMessage("");
    setErrorMessage("");
    setBusy(true);

    const supabase = createClient();
    const marker = "/storage/v1/object/public/bonus-covers/";
    const markerIndex = resource.image_url.indexOf(marker);
    const storagePath = markerIndex >= 0
      ? decodeURIComponent(resource.image_url.slice(markerIndex + marker.length))
      : null;

    if (markerIndex >= 0 && (!storagePath || !storagePath.startsWith(`${userId}/`))) {
      setErrorMessage("Sampul tidak berada pada lokasi Storage yang diharapkan; resource tidak dihapus.");
      setBusy(false);
      return;
    }

    const { error: deleteError } = await supabase.from("bonus_resources").delete().eq("id", resource.id);
    if (deleteError) {
      setErrorMessage(`Gagal menghapus resource: ${deleteError.message}`);
      setBusy(false);
      return;
    }

    setResources((items) => items.filter((item) => item.id !== resource.id));
    if (!storagePath) {
      setMessage("Resource berhasil dihapus.");
    } else {
      const { error: storageError } = await supabase.storage.from("bonus-covers").remove([storagePath]);
      if (storageError) {
        setErrorMessage(`Resource dihapus, tetapi sampul gagal dibersihkan dari Storage: ${storageError.message}`);
      } else {
        setMessage("Resource berhasil dihapus.");
      }
    }
    setBusy(false);
  }

  return (
    <main className="cosmos admin-screen">
      <div className="stars stars-one" />
      <div className="stars stars-two" />
      <div className="nebula nebula-left" />
      <div className="nebula nebula-right" />
      <header className="topbar shell admin-topbar">
        <a href="/dashboard" className="brand" aria-label="Kembali ke dashboard">
          <Image className="brand-logo" src="/joolo-logo.png" width={566} height={161} alt="" />
        </a>
        <a className="admin-back-link" href="/dashboard">Kembali ke dashboard</a>
      </header>

      <div className="admin-content shell">
        <section className="admin-heading">
          <span className="eyebrow"><span className="eyebrow-line" /> ADMINISTRATION</span>
          <h1>Manage <span>JOOLO</span></h1>
          <p>Kelola resource Bonus dan data pengguna uji leaderboard. Perubahan skor pengguna uji langsung memengaruhi peringkat Daily dan Weekly.</p>
        </section>

        <section className="admin-panel" aria-labelledby="admin-upload-title">
          <span className="eyebrow">PUBLISH A RESOURCE</span>
          <h2 id="admin-upload-title">Tambah bonus resource</h2>
          <form className="admin-form" onSubmit={(event) => { void uploadResource(event); }}>
            <label htmlFor="bonus-type">JENIS RESOURCE</label>
            <select id="bonus-type" name="type" defaultValue="ebook" required>
              <option value="ebook">E-book (PDF)</option>
              <option value="tracker">Tracker (Excel)</option>
            </select>

            <label htmlFor="bonus-title">JUDUL</label>
            <input id="bonus-title" name="title" type="text" maxLength={100} placeholder="Contoh: 40-Day Habit Tracker" required />

            <label htmlFor="bonus-description">DESKRIPSI SINGKAT</label>
            <textarea id="bonus-description" name="description" maxLength={300} rows={3} placeholder="Jelaskan isi dan manfaat resource ini." required />

            <label htmlFor="bonus-cover">LINK GAMBAR SAMPUL GOOGLE DRIVE</label>
            <input id="bonus-cover" name="coverUrl" type="url" placeholder="https://drive.google.com/file/d/..." required />
            <small>Pastikan akses file di Google Drive diatur ke “Siapa saja yang memiliki link”.</small>

            <label htmlFor="bonus-download-url">LINK DOWNLOAD GOOGLE DRIVE</label>
            <input id="bonus-download-url" name="downloadUrl" type="url" placeholder="https://drive.google.com/..." required />

            {errorMessage && <p className="admin-feedback is-error" role="alert">{errorMessage}</p>}
            {message && <p className="admin-feedback" role="status">{message}</p>}
            <button className="primary-button admin-submit" type="submit" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan ke Bonus"}
            </button>
          </form>
        </section>

        <section className="admin-resource-section" aria-labelledby="coin-test-users-title">
          <div className="admin-list-heading">
            <div>
              <span className="eyebrow">LEADERBOARD TEST DATA</span>
              <h2 id="coin-test-users-title">Pengguna uji leaderboard <span>({coinTestUsers.length})</span></h2>
            </div>
            <div className="admin-test-user-heading-actions">
              <button
                className="admin-test-users-shuffle"
                type="button"
                disabled={coinTestUsersBusy || coinTestUsers.length < 2}
                onClick={() => { void shuffleCoinTestUserScores(); }}
              >
                {coinTestUsersBusy ? "Mengacak..." : "Acak ulang Daily & Weekly"}
              </button>
              {coinTestUserDraft.userId && (
                <button
                  className="admin-delete"
                  type="button"
                  disabled={coinTestUsersBusy}
                  onClick={() => setCoinTestUserDraft(newCoinTestUserDraft)}
                >
                  Batal edit
                </button>
              )}
            </div>
          </div>
          <p className="admin-test-users-note">Kelola nama dan total koin uji tanpa batas maksimum. Acak ulang mengubah skor Daily dan Weekly seluruh pengguna uji secara terpisah tanpa memengaruhi pengguna nyata.</p>
          <form ref={coinTestUserFormRef} className="admin-form admin-test-user-form" onSubmit={(event) => { void saveCoinTestUser(event); }}>
            <label htmlFor="coin-test-name">DISPLAY NAME</label>
            <input
              ref={coinTestUserNameInputRef}
              id="coin-test-name"
              type="text"
              maxLength={60}
              required
              value={coinTestUserDraft.displayName}
              onChange={(event) => {
                const displayName = event.currentTarget.value;
                setCoinTestUserDraft((draft) => ({ ...draft, displayName }));
              }}
              placeholder="Nama pengguna"
            />

            <label htmlFor="coin-test-gender">GENDER / JENIS AVATAR</label>
            <select
              id="coin-test-gender"
              value={coinTestUserDraft.gender}
              onChange={(event) => {
                const gender = event.currentTarget.value === "man" ? "man" : "woman";
                setCoinTestUserDraft((draft) => ({ ...draft, gender }));
              }}
            >
              <option value="woman">Woman</option>
              <option value="man">Man</option>
            </select>

            <div className="admin-test-score-fields">
              <div>
                <label htmlFor="coin-test-daily">DAILY COINS</label>
                <input
                  id="coin-test-daily"
                  type="number"
                  min={140}
                  step={10}
                  required
                  value={coinTestUserDraft.dailyCoin}
                  onChange={(event) => {
                    const dailyCoin = event.currentTarget.value;
                    setCoinTestUserDraft((draft) => ({ ...draft, dailyCoin }));
                  }}
                />
              </div>
              <div>
                <label htmlFor="coin-test-weekly">WEEKLY COINS</label>
                <input
                  id="coin-test-weekly"
                  type="number"
                  min={980}
                  step={10}
                  required
                  value={coinTestUserDraft.weeklyCoin}
                  onChange={(event) => {
                    const weeklyCoin = event.currentTarget.value;
                    setCoinTestUserDraft((draft) => ({ ...draft, weeklyCoin }));
                  }}
                />
              </div>
            </div>

            {coinTestUsersError && <p className="admin-feedback is-error" role="alert">{coinTestUsersError}</p>}
            {coinTestUsersMessage && <p className="admin-feedback" role="status">{coinTestUsersMessage}</p>}
            <button className="primary-button admin-submit" type="submit" disabled={coinTestUsersBusy}>
              {coinTestUsersBusy ? "Menyimpan..." : coinTestUserDraft.userId ? "Simpan perubahan" : "Tambah pengguna uji"}
            </button>
          </form>

          {coinTestUsers.length === 0 ? (
            <p className="admin-empty">Belum ada pengguna uji. Tambahkan pengguna melalui formulir di atas.</p>
          ) : (
            <>
              <div className="admin-test-user-filters">
                <label className="admin-test-user-search">
                  <span>CARI PENGGUNA</span>
                  <input
                    type="search"
                    value={coinTestUserSearch}
                    onChange={(event) => setCoinTestUserSearch(event.currentTarget.value)}
                    placeholder="Cari berdasarkan nama..."
                    aria-label="Cari pengguna uji berdasarkan nama"
                  />
                </label>
                <label>
                  <span>FILTER GENDER</span>
                  <select
                    value={coinTestUserGenderFilter}
                    onChange={(event) => setCoinTestUserGenderFilter(event.currentTarget.value === "man" || event.currentTarget.value === "woman" ? event.currentTarget.value : "all")}
                    aria-label="Filter pengguna uji berdasarkan gender"
                  >
                    <option value="all">Semua gender</option>
                    <option value="woman">Woman</option>
                    <option value="man">Man</option>
                  </select>
                </label>
                <label>
                  <span>URUTKAN</span>
                  <select
                    value={coinTestUserSort}
                    onChange={(event) => setCoinTestUserSort(event.currentTarget.value === "daily" || event.currentTarget.value === "weekly" ? event.currentTarget.value : "name")}
                    aria-label="Urutkan pengguna uji"
                  >
                    <option value="name">Nama A–Z</option>
                    <option value="daily">Daily coins terbanyak</option>
                    <option value="weekly">Weekly coins terbanyak</option>
                  </select>
                </label>
              </div>
              <p className="admin-test-users-count" role="status">
                Menampilkan {visibleCoinTestUsers.length} dari {coinTestUsers.length} pengguna
              </p>
              {visibleCoinTestUsers.length === 0 ? (
                <p className="admin-empty">Tidak ada pengguna yang cocok dengan pencarian atau filter.</p>
              ) : (
                <div className="admin-test-user-list">
              {visibleCoinTestUsers.map((testUser) => (
                <article className="admin-test-user-item" key={testUser.user_id}>
                  <img src={testUser.avatar_url} alt="" />
                  <div className="admin-test-user-copy">
                    <strong>{testUser.display_name}</strong>
                    <span>{testUser.gender === "man" ? "Man" : "Woman"}</span>
                    <small>Daily: {testUser.daily_coin.toLocaleString("id-ID")} · Weekly: {testUser.weekly_coin.toLocaleString("id-ID")} coins</small>
                  </div>
                  <div className="admin-test-user-actions">
                    <button className="admin-delete" type="button" disabled={coinTestUsersBusy} onClick={() => editCoinTestUser(testUser)}>Edit</button>
                    <button className="admin-delete is-danger" type="button" disabled={coinTestUsersBusy} onClick={() => { void deleteCoinTestUser(testUser); }}>Hapus</button>
                  </div>
                </article>
              ))}
                </div>
              )}
            </>
          )}
        </section>

        <section className="admin-resource-section" aria-labelledby="admin-resource-title">
          <div className="admin-list-heading">
            <div><span className="eyebrow">LIVE IN THE DASHBOARD</span><h2 id="admin-resource-title">Bonus resources <span>({resources.length})</span></h2></div>
          </div>
          {resources.length === 0 ? (
            <p className="admin-empty">Belum ada resource. Resource yang diunggah akan langsung muncul di menu Bonus.</p>
          ) : (
            <div className="admin-resource-list">
              {resources.map((resource) => (
                <article className="admin-resource-item" key={resource.id}>
                  <img src={resource.image_url} alt={`Sampul ${resource.title}`} />
                  <div className="admin-resource-copy">
                    <span className="bonus-category">{resource.type === "ebook" ? "E-BOOK · PDF" : "TRACKER · EXCEL"}</span>
                    <h3>{resource.title}</h3>
                    <p>{resource.description}</p>
                    <a href={resource.download_url} target="_blank" rel="noreferrer">Buka link download ↗</a>
                  </div>
                  <button className="admin-delete" type="button" disabled={busy} onClick={() => { void deleteResource(resource); }}>
                    Hapus
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
