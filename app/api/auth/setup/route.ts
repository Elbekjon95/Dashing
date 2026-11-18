import { authConfigured, ipOf, isHttps, makeToken, recordFail, sameOrigin, sessionCookie, tooMany } from "@/lib/auth";
import { createFirstAdmin, isFail, needsSetup } from "@/lib/users";

export const dynamic = "force-dynamic";

const json = (body: object, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...extra } });

// Birinchi foydalanuvchini (ADMIN) yaratadi. Foydalanuvchilar allaqachon bor boʻlsa — 409.
export async function POST(req: Request) {
  if (!authConfigured()) return json({ error: "not_configured" }, 503);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = ipOf(req);
  if (tooMany(ip)) return json({ error: "too_many" }, 429);
  if (!needsSetup()) return json({ error: "already_setup" }, 409);

  let b: { username?: unknown; password?: unknown } | null = null;
  try { b = await req.json(); } catch {}
  const user = typeof b?.username === "string" ? b.username.slice(0, 64) : "";
  const pass = typeof b?.password === "string" ? b.password.slice(0, 256) : "";
  if (!user || !pass) return json({ error: "invalid" }, 400);

  const r = await createFirstAdmin(user, pass);
  if (isFail(r)) {
    if (r.error !== "already_setup") recordFail(ip);
    return json({ error: r.error }, r.error === "already_setup" ? 409 : 400);
  }
  const { token, maxAge } = makeToken(r.username, true);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token, maxAge, isHttps(req)) });
}
