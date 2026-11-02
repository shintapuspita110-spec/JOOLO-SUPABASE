export const supabaseCookieOptions = {
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
