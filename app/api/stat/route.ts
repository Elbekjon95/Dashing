import { requireAuth } from "@/lib/auth";
import { dbConfigured, runParam } from "@/lib/db";
import { AIRPORTS, STAT_SQL } from "@/lib/statsql";

export const dynamic = "force-dynamic";

// GET /api/stat?from=2026-11-01&to=2026-11-18&cfrom=2026-10-01&cto=2026-10-18&ap=ALL
// Ikki davrni bazadan hisoblab qaytaradi. Natija qisqa vaqt keshlanadi (bir xil soʻrov bazani qayta yuklamasin).
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; body: string }>();
const inflight = new Map<string, Promise<string>>();

const ms = (s: string) => Date.parse(s + "T00:00:00Z");
const bad = (m: string, status = 400) => Response.json({ error: m }, { status });

export async function GET(req: Request) {
  const denied = requireAuth(req); // faqat avtorizatsiyadan oʻtganlarga
  if (denied) return denied;
  if (!dbConfigured()) return bad("Baza sozlanmagan", 503);
  const q = new URL(req.url).searchParams;
  const from = q.get("from") || "", to = q.get("to") || "", cfrom = q.get("cfrom") || "", cto = q.get("cto") || "", ap = (q.get("ap") || "ALL").toUpperCase();
  for (const d of [from, to, cfrom, cto]) if (!DATE.test(d) || isNaN(ms(d))) return bad("Sana formati notoʻgʻri (YYYY-MM-DD)");
  if (ms(from) > ms(to) || ms(cfrom) > ms(cto)) return bad("Boshlanish sanasi tugash sanasidan keyin boʻlmasin");
  if (ap !== "ALL" && !AIRPORTS.includes(ap)) return bad("Aeroport kodi notoʻgʻri");

  const key = [from, to, cfrom, cto, ap].join("|");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return new Response(hit.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-cache": "hit" } });

  try {
    let p = inflight.get(key); // bir vaqtda bir xil soʻrov kelsa, bazaga bitta murojaat
    if (!p) {
      p = runParam(STAT_SQL, [from, to, cfrom, cto, ap]).then((r) => JSON.stringify(r)).finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    const body = await p;
    cache.set(key, { at: Date.now(), body });
    if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return bad("Bazadan hisoblab boʻlmadi: " + (e instanceof Error ? e.message : String(e)), 502);
  }
}
