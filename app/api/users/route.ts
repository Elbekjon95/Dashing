import { requireAdmin, sameOrigin } from "@/lib/auth";
import { createUser, deleteUser, isFail, listUsers, updateUser, type Role } from "@/lib/users";

export const dynamic = "force-dynamic";

// Foydalanuvchilarni boshqarish — faqat admin.
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const STATUS: Record<string, number> = { exists: 409, not_found: 404, last_admin: 409, self: 409 };
const fail = (error: string) => json({ error }, STATUS[error] ?? 400);

async function body(req: Request): Promise<Record<string, unknown>> {
  try { const b = await req.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; }
}
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const roleOf = (v: unknown): Role | undefined => (v === "admin" || v === "user" ? v : undefined);

export async function GET(req: Request) {
  const a = requireAdmin(req);
  if ("res" in a) return a.res;
  return json({ users: listUsers(), me: a.session.user });
}

export async function POST(req: Request) {
  const a = requireAdmin(req);
  if ("res" in a) return a.res;
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const b = await body(req);
  const r = await createUser(str(b.username, 64), str(b.password, 256), roleOf(b.role) ?? "user");
  return isFail(r) ? fail(r.error) : json({ user: r }, 201);
}

// parolni almashtirish va/yoki rolni oʻzgartirish
export async function PATCH(req: Request) {
  const a = requireAdmin(req);
  if ("res" in a) return a.res;
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const b = await body(req);
  const password = typeof b.password === "string" && b.password ? b.password.slice(0, 256) : undefined;
  const r = await updateUser(str(b.username, 64), { password, role: roleOf(b.role) });
  return isFail(r) ? fail(r.error) : json({ user: r });
}

export async function DELETE(req: Request) {
  const a = requireAdmin(req);
  if ("res" in a) return a.res;
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const name = str((await body(req)).username, 64).trim().toLowerCase();
  if (name === a.session.user) return fail("self"); // oʻzini oʻchira olmaydi
  const r = await deleteUser(name);
  return isFail(r) ? fail(r.error) : json(r);
}
