import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { COOKIE, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Avtorizatsiyadan oʻtmaganlar kirish sahifasiga yoʻnaltiriladi.
export default async function Page() {
  const c = await cookies();
  const s = verifyToken(c.get(COOKIE)?.value);
  if (!s) redirect("/login");
  return <Dashboard isAdmin={s.role === "admin"} />;
}