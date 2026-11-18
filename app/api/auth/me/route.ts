import { sessionOf } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = sessionOf(req);
  return Response.json(s ? { user: s.user, role: s.role } : { error: "Avtorizatsiya talab qilinadi" }, { status: s ? 200 : 401, headers: { "cache-control": "no-store" } });
}
