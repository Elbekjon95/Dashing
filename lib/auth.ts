// Avtorizatsiya: foydalanuvchi/parol (scrypt bilan xeshlangan, lib/users.ts faylida) + imzolangan HttpOnly sessiya cookie.
// Sozlash (.env.local):
//   DASH_SESSION_SECRET=<uzun tasodifiy matn>   — cookie imzosi uchun (kamida 32 belgi)
// Foydalanuvchilar birinchi kirishda yaratiladi: birinchi roʻyxatdan oʻtgan — admin, qolganlarini admin qoʻshadi.
// DASH_SESSION_SECRET sozlanmagan boʻlsa — hech kim kira olmaydi (xavfsiz tomonga yopiq).
import { createHmac, timingSafeEqual } from "node:crypto";
import { getUser, type Role } from "./users";

export { verifyPassword } from "./users";

export const COOKIE = "dash_session";
const SHORT_S = 12 * 3600;       // oddiy sessiya: 12 soat
const LONG_S = 30 * 24 * 3600;   // «meni eslab qol»: 30 kun

const env = (k: string) => (process.env[k] ?? "").trim();
const secret = () => env("DASH_SESSION_SECRET");

export const authConfigured = () => secret().length >= 32;

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function makeToken(user: string, remember: boolean) {
  const exp = Math.floor(Date.now() / 1000) + (remember ? LONG_S : SHORT_S);
  const body = b64(JSON.stringify({ u: user.toLowerCase(), exp }));
  return { token: body + "." + sign(body), maxAge: remember ? LONG_S : SHORT_S };
}

export type Session = { user: string; role: Role };
export function verifyToken(token: string | undefined | null): Session | null {
  if (!token || !secret()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = sign(body);
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.u || !p.exp || p.exp < Date.now() / 1000) return null;
    const u = getUser(p.u); // oʻchirilgan foydalanuvchining sessiyasi bekor; rol har safar yangidan olinadi
    if (!u) return null;
    return { user: u.username, role: u.role };
  } catch {
    return null;
  }
}

export function cookieOf(req: Request, name = COOKIE): string | null {
  const h = req.headers.get("cookie") || "";
  for (const part of h.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export const sessionOf = (req: Request) => verifyToken(cookieOf(req));

/** API himoyasi: sessiya yoʻq boʻlsa — 401 javobi, boʻlsa — null. */
export function requireAuth(req: Request): Response | null {
  if (sessionOf(req)) return null;
  return Response.json({ error: "Avtorizatsiya talab qilinadi" }, { status: 401, headers: { "cache-control": "no-store" } });
}

/** Faqat admin uchun: sessiya yoʻq — 401, admin emas — 403; boʻlmasa sessiya qaytadi. */
export function requireAdmin(req: Request): { res: Response } | { session: Session } {
  const noStore = { "cache-control": "no-store" };
  const s = sessionOf(req);
  if (!s) return { res: Response.json({ error: "Avtorizatsiya talab qilinadi" }, { status: 401, headers: noStore }) };
  if (s.role !== "admin") return { res: Response.json({ error: "forbidden" }, { status: 403, headers: noStore }) };
  return { session: s };
}

/** CSRF: brauzer Origin yuborgan boʻlsa, u shu serverniki boʻlishi shart. */
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (!o) return true;
  try { return new URL(o).host === (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host); } catch { return false; }
}

export function isHttps(req: Request) {
  return req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:" || env("DASH_COOKIE_SECURE") === "1";
}

export function sessionCookie(token: string, maxAge: number, secure: boolean) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
export const clearCookie = (secure: boolean) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;

// ---- kirish urinishlarini cheklash (brute-force himoyasi): IP boʻyicha 10 daqiqada 8 ta xato
const fails = new Map<string, { n: number; until: number }>();
const WINDOW = 10 * 60_000, MAX_FAILS = 8;
export function ipOf(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
export function tooMany(ip: string) {
  const f = fails.get(ip);
  return !!f && f.until > Date.now() && f.n >= MAX_FAILS;
}
export function recordFail(ip: string) {
  const now = Date.now(), f = fails.get(ip);
  if (!f || f.until < now) fails.set(ip, { n: 1, until: now + WINDOW });
  else f.n++;
  if (fails.size > 5000) fails.delete(fails.keys().next().value as string);
}
export const clearFails = (ip: string) => { fails.delete(ip); };
