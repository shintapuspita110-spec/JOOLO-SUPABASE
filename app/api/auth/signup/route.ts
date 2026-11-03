import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { signupAvatars, type SignupGender } from "@/lib/signup-avatars";

type SignupPayload = {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  gender?: unknown;
  ageRange?: unknown;
  avatarUrl?: unknown;
};

type PendingCookie = { name: string; value: string; options: CookieOptions };

function jsonResponse(status: number, body: { error?: string; created?: boolean; requiresEmailConfirmation?: boolean }): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function jsonResponseWithCookies(
  status: number,
  body: { error?: string; created?: boolean; requiresEmailConfirmation?: boolean },
  cookiesToSet: PendingCookie[],
  headers: Record<string, string>,
) {
  const response = NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

function redirectResponse(
  request: Request,
  path: string,
  cookiesToSet: PendingCookie[] = [],
  headers: Record<string, string> = {},
) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const isFormSubmission = contentType.startsWith("application/x-www-form-urlencoded")
    || contentType.startsWith("multipart/form-data");
  const fail = (errorCode: string, message: string, status = 400) => (
    isFormSubmission
      ? redirectResponse(request, `/signup?error=${errorCode}`)
      : jsonResponse(status, { error: message })
  );

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return fail("invalid-signup", "Permintaan pendaftaran tidak valid. Muat ulang halaman dan coba lagi.", 403);
  }
  if (!isFormSubmission && !contentType.startsWith("application/json")) {
    return jsonResponse(415, { error: "Format permintaan pendaftaran tidak valid." });
  }

  let payload: SignupPayload;
  try {
    if (isFormSubmission) {
      const formData = await request.formData();
      payload = {
        email: formData.get("email"),
        password: formData.get("password"),
        fullName: formData.get("fullName"),
        gender: formData.get("gender"),
        ageRange: formData.get("ageRange"),
        avatarUrl: formData.get("avatarUrl"),
      };
    } else {
      const body: unknown = await request.json();
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return fail("invalid-signup", "Periksa kembali data pendaftaran.");
      }
      payload = body as SignupPayload;
    }
  } catch {
    return fail("invalid-signup", "Data pendaftaran tidak dapat dibaca. Muat ulang halaman dan coba lagi.");
  }

  const gender = payload.gender === "woman" || payload.gender === "man" ? payload.gender : null;
  const ageRange = payload.ageRange;
  if (
    typeof payload.email !== "string"
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())
    || payload.email.length > 320
    || typeof payload.password !== "string"
    || payload.password.length < 8
    || payload.password.length > 1024
    || typeof payload.fullName !== "string"
    || payload.fullName.trim().length === 0
    || payload.fullName.trim().length > 60
    || !gender
    || (ageRange !== "<18" && ageRange !== "18-25" && ageRange !== ">25")
  ) {
    return fail("invalid-signup", "Pastikan nama, email, password, gender, usia, dan avatar sudah diisi dengan benar.");
  }

  const avatarUrl = typeof payload.avatarUrl === "string" && payload.avatarUrl.length > 0
    ? payload.avatarUrl
    : signupAvatars[gender][0].src;
  if (!signupAvatars[gender].some((avatar) => avatar.src === avatarUrl)) {
    return fail("invalid-signup", "Pilih avatar yang sesuai dengan gender.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Signup endpoint is missing Supabase configuration.");
    return fail("service-unavailable", "Layanan pendaftaran sedang tidak tersedia. Silakan coba lagi nanti.", 503);
  }

  const cookieStore = await cookies();
  const pendingCookies: PendingCookie[] = [];
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

  const { data, error } = await supabase.auth.signUp({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    options: {
      data: {
        full_name: payload.fullName.trim(),
        gender: gender satisfies SignupGender,
        age_range: ageRange,
        avatar_url: avatarUrl,
      },
      emailRedirectTo: new URL("/auth/callback?next=/dashboard", request.url).toString(),
    },
  });

  if (error) {
    return isFormSubmission
      ? redirectResponse(request, "/signup?error=signup-failed", pendingCookies, pendingHeaders)
      : jsonResponseWithCookies(400, { error: error.message }, pendingCookies, pendingHeaders);
  }

  if (data.session) {
    return isFormSubmission
      ? redirectResponse(request, "/onboarding/access-code", pendingCookies, pendingHeaders)
      : jsonResponseWithCookies(200, { created: true }, pendingCookies, pendingHeaders);
  }

  if (!data.user) {
    console.error("Supabase signup returned no user and no error.");
    return isFormSubmission
      ? redirectResponse(request, "/signup?error=signup-failed", pendingCookies, pendingHeaders)
      : jsonResponseWithCookies(
        502,
        { error: "Pendaftaran belum membuat akun. Silakan coba lagi." },
        pendingCookies,
        pendingHeaders,
      );
  }

  return isFormSubmission
    ? redirectResponse(request, "/signup?notice=check-email", pendingCookies, pendingHeaders)
    : jsonResponseWithCookies(
      200,
      { created: true, requiresEmailConfirmation: true },
      pendingCookies,
      pendingHeaders,
    );
}
