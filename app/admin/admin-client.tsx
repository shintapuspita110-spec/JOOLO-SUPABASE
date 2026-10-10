"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UploadedBonusResource, BonusType } from "@/lib/bonus";

const maxImageSize = 5 * 1024 * 1024;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];

export default function AdminClient({
  userId,
  initialResources,
}: {
  userId: string;
  initialResources: UploadedBonusResource[];
}) {
  const [resources, setResources] = useState(initialResources);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
    const cover = values.get("cover");

    if (!(cover instanceof File) || cover.size === 0) {
      setErrorMessage("Pilih gambar sampul untuk resource ini.");
      return;
    }
    if (!imageTypes.includes(cover.type) || cover.size > maxImageSize) {
      setErrorMessage("Sampul harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
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

    const extension = cover.type === "image/jpeg" ? "jpg" : cover.type === "image/png" ? "png" : "webp";
    const storagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
    setBusy(true);

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("bonus-covers")
      .upload(storagePath, cover, { contentType: cover.type, upsert: false });

    if (uploadError) {
      setErrorMessage(`Gagal mengunggah sampul: ${uploadError.message}`);
      setBusy(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("bonus-covers").getPublicUrl(storagePath);
    const { data: resource, error: insertError } = await supabase
      .from("bonus_resources")
      .insert({
        type,
        title,
        description,
        image_url: publicUrl,
        download_url: downloadUrl,
        created_by: userId,
      })
      .select("id, type, title, description, image_url, download_url, created_at")
      .single();

    if (insertError) {
      const { error: cleanupError } = await supabase.storage.from("bonus-covers").remove([storagePath]);
      setErrorMessage(cleanupError
        ? `Gagal menyimpan resource: ${insertError.message}. Pembersihan sampul juga gagal: ${cleanupError.message}`
        : `Gagal menyimpan resource: ${insertError.message}`);
      setBusy(false);
      return;
    }

    setResources((items) => [resource as UploadedBonusResource, ...items]);
    form.reset();
    setMessage("Resource berhasil diunggah dan sekarang muncul di menu Bonus.");
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

    if (!storagePath || !storagePath.startsWith(`${userId}/`)) {
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
    const { error: storageError } = await supabase.storage.from("bonus-covers").remove([storagePath]);
    if (storageError) {
      setErrorMessage(`Resource dihapus, tetapi sampul gagal dibersihkan dari Storage: ${storageError.message}`);
    } else {
      setMessage("Resource berhasil dihapus.");
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
          <span className="brand-mark">✦</span>
          <span>JO<span className="brand-muted">O</span>LO<span className="brand-dot">.</span></span>
        </a>
        <a className="admin-back-link" href="/dashboard">Kembali ke dashboard</a>
      </header>

      <div className="admin-content shell">
        <section className="admin-heading">
          <span className="eyebrow"><span className="eyebrow-line" /> ADMINISTRATION</span>
          <h1>Manage <span>Bonus</span></h1>
          <p>Tambahkan e-book atau tracker. Sampul disimpan di Supabase Storage dan file diunduh dari link Google Drive.</p>
        </section>

        <section className="admin-panel" aria-labelledby="admin-upload-title">
          <span className="eyebrow">PUBLISH A RESOURCE</span>
          <h2 id="admin-upload-title">Upload bonus resource</h2>
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

            <label htmlFor="bonus-cover">GAMBAR SAMPUL (JPG, PNG, WEBP; MAKS. 5 MB)</label>
            <input id="bonus-cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" required />

            <label htmlFor="bonus-download-url">LINK DOWNLOAD GOOGLE DRIVE</label>
            <input id="bonus-download-url" name="downloadUrl" type="url" placeholder="https://drive.google.com/..." required />

            {errorMessage && <p className="admin-feedback is-error" role="alert">{errorMessage}</p>}
            {message && <p className="admin-feedback" role="status">{message}</p>}
            <button className="primary-button admin-submit" type="submit" disabled={busy}>
              {busy ? "Menyimpan..." : "Upload ke Bonus"}
            </button>
          </form>
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
