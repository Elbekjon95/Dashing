import { sessionOf } from "@/lib/auth";
import { healthInfo, startScheduler } from "@/lib/db";

export const dynamic = "force-dynamic";

// Monitoring uchun: 200 = hammasi joyida, 503 = baza ulanmagan yoki tez maʼlumot eskirgan.
// Kirmagan foydalanuvchiga faqat holat (ok) beriladi; tafsilotlar (qaysi soʻrov, xato matni) faqat avtorizatsiyadan oʻtganlarga.
export async function GET(req: Request) {
  startScheduler();
  const h = healthInfo();
  const body = sessionOf(req) ? h : { ok: h.ok };
  return Response.json(body, { status: h.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}