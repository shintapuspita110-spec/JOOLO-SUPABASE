import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function jsonResponse(status: number, body: { error?: string; authenticated?: boolean }): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return jsonResponse(403, { error: "Permintaan login tidak valid. Muat ulang halaman dan coba lagi." });
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse(415, { error: "Format permintaan login tidak valid." });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "Data login tidak dapat dibaca. Muat ulang halaman dan coba lagi." });
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return jsonResponse(400, { error: "Masukkan email dan password yang valid." });
  }
  const credentials = payload as Record<string, unknown>;
  if (
    typeof credentials.email !== "string"
    || credentials.email.trim().length < 3
    || credentials.email.length > 320
    || typeof credentials.password !== "string"
    || credentials.password.length === 0
    || credentials.password.length > 1024
  ) {
    return jsonResponse(400, { error: "Masukkan email dan password yang valid." });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Login endpoint is missing Supabase configuration.");
    return jsonResponse(503, { error: "Layanan login belum dikonfigurasi. Silakan coba lagi nanti." });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email.trim().toLowerCase(),
    password: credentials.password,
  });

  if (error) {
    return jsonResponse(401, { error: error.message });
  }
  if (!data.session) {
    console.error("Supabase login returned no session and no error.");
    return jsonResponse(502, { error: "Login belum membuat sesi. Silakan coba lagi." });
  }

  return jsonResponse(200, { authenticated: true });
}
