const authErrorMessages: Record<string, string> = {
  "session-missing": "Login diterima, tetapi sesi tidak tersimpan di browser. Periksa pengaturan cookie browser, lalu coba lagi. Jika tetap terjadi, hubungi tim dukungan.",
  "session-not-created": "Login belum membuat sesi. Silakan coba lagi.",
  "login-failed": "Email atau password tidak cocok. Periksa kembali lalu coba lagi.",
  "invalid-request": "Permintaan login tidak valid. Muat ulang halaman dan coba lagi.",
  "service-unavailable": "Layanan login sedang tidak tersedia. Silakan coba lagi nanti.",
};

export function getAuthErrorMessage(error: string): string {
  return authErrorMessages[error] ?? error;
}
