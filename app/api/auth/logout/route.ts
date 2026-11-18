import { clearCookie, isHttps } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store", "set-cookie": clearCookie(isHttps(req)) } });
}
