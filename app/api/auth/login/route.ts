import { authConfigured, clearFails, ipOf, isHttps, makeToken, recordFail, sameOrigin, sessionCookie, tooMany, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const json = (body: object, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...extra } });

export async function POST(req: Request) {
  if (!authConfigured()) return json({ error: "not_configured" }, 503);
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = ipOf(req);
  if (tooMany(ip)) return json({ error: "too_many" }, 429);

  let b: { username?: unknown; password?: unknown; remember?: unknown } | null = null;
  try { b = await req.json(); } catch {}
  const user = typeof b?.username === "string" ? b.username.slice(0, 64) : "";
  const pass = typeof b?.password === "string" ? b.password.slice(0, 256) : "";
  if (!user || !pass) return json({ error: "invalid" }, 400);

  if (!verifyPassword(user, pass)) {
    recordFail(ip);
    await new Promise((r) => setTimeout(r, 500)); // taxmin qilishni sekinlashtiradi
    return json({ error: "invalid" }, 401);
  }
  clearFails(ip);
  const { token, maxAge } = makeToken(user, !!b?.remember);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token, maxAge, isHttps(req)) });
}
