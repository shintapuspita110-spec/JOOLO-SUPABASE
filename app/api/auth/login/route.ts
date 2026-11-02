import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";

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
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const isFormSubmission = contentType.startsWith("application/x-www-form-urlencoded")
    || contentType.startsWith("multipart/form-data");
  const loginErrorRedirect = (errorCode: string) => {
    const response = NextResponse.redirect(new URL(`/login?error=${errorCode}`, request.url), 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    if (isFormSubmission) return loginErrorRedirect("invalid-request");
    return jsonResponse(403, { error: "Permintaan login tidak valid. Muat ulang halaman dan coba lagi." });
  }

  if (!isFormSubmission && !contentType.startsWith("application/json")) {
    return jsonResponse(415, { error: "Format permintaan login tidak valid." });
  }

  let payload: unknown;
  try {
    if (isFormSubmission) {
      const formData = await request.formData();
      payload = {
        email: formData.get("email"),
        password: formData.get("password"),
      };
    } else {
      payload = await request.json();
    }
  } catch {
    if (isFormSubmission) return loginErrorRedirect("invalid-request");
    return jsonResponse(400, { error: "Data login tidak dapat dibaca. Muat ulang halaman dan coba lagi." });
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    if (isFormSubmission) return loginErrorRedirect("invalid-request");
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
    if (isFormSubmission) return loginErrorRedirect("invalid-request");
    return jsonResponse(400, { error: "Masukkan email dan password yang valid." });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Login endpoint is missing Supabase configuration.");
    if (isFormSubmission) return loginErrorRedirect("service-unavailable");
    return jsonResponse(503, { error: "Layanan login belum dikonfigurasi. Silakan coba lagi nanti." });
  }

  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  let pendingHeaders: Record<string, string> = {};
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        pendingCookies.push(...cookiesToSet);
        pendingHeaders = { ...pendingHeaders, ...headers };
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email.trim().toLowerCase(),
    password: credentials.password,
  });

  if (error) {
    if (isFormSubmission) return loginErrorRedirect("login-failed");
    return jsonResponse(401, { error: error.message });
  }
  if (!data.session) {
    console.error("Supabase login returned no session and no error.");
    if (isFormSubmission) return loginErrorRedirect("session-not-created");
    return jsonResponse(502, { error: "Login belum membuat sesi. Silakan coba lagi." });
  }

  if (isFormSubmission) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    response.headers.set("Cache-Control", "no-store");
    Object.entries(pendingHeaders).forEach(([name, value]) => response.headers.set(name, value));
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  }

  const response = NextResponse.json(
    { authenticated: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...pendingHeaders,
      },
    },
  );
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
