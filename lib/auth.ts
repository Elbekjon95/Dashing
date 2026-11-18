// Avtorizatsiya: foydalanuvchi/parol (scrypt bilan xeshlangan) + imzolangan HttpOnly sessiya cookie.
// Sozlash (.env.local):
//   DASH_USERS=admin:<salt>:<hash>,boshqa:<salt>:<hash>   — `node scripts/make-user.mjs <login> <parol>` shu qatorni chiqaradi
//   DASH_SESSION_SECRET=<uzun tasodifiy matn>               — cookie imzosi uchun (kamida 32 belgi)
// Sozlanmagan boʻlsa — hech kim kira olmaydi (xavfsiz tomonga yopiq).
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const COOKIE = "dash_session";
const SHORT_S = 12 * 3600;       // oddiy sessiya: 12 soat
const LONG_S = 30 * 24 * 3600;   // «meni eslab qol»: 30 kun

const env = (k: string) => (process.env[k] ?? "").trim();
const secret = () => env("DASH_SESSION_SECRET");

function users(): Record<string, { salt: string; hash: string }> {
  const out: Record<string, { salt: string; hash: string }> = {};
  for (const part of env("DASH_USERS").split(",")) {
    const [u, salt, hash] = part.trim().split(":");
    if (u && salt && hash) out[u.toLowerCase()] = { salt, hash };
  }
  return out;
}

export const authConfigured = () => Object.keys(users()).length > 0 && secret().length >= 32;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 32).toString("hex") };
}

const DUMMY = { salt: "00".repeat(16), hash: "00".repeat(32) };
export function verifyPassword(user: string, password: string): boolean {
  const rec = users()[user.trim().toLowerCase()];
  const r = rec || DUMMY; // foydalanuvchi yoʻq boʻlsa ham bir xil vaqt sarflanadi
  const got = scryptSync(password, r.salt, 32);
  const want = Buffer.from(r.hash, "hex");
  const ok = got.length === want.length && timingSafeEqual(got, want);
  return !!rec && ok;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function makeToken(user: string, remember: boolean) {
  const exp = Math.floor(Date.now() / 1000) + (remember ? LONG_S : SHORT_S);
  const body = b64(JSON.stringify({ u: user.toLowerCase(), exp }));
  return { token: body + "." + sign(body), maxAge: remember ? LONG_S : SHORT_S };
}

export function verifyToken(token: string | undefined | null): { user: string } | null {
  if (!token || !secret()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = sign(body);
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.u || !p.exp || p.exp < Date.now() / 1000) return null;
    if (!users()[p.u]) return null; // oʻchirilgan foydalanuvchining sessiyasi ham bekor
    return { user: p.u };
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
