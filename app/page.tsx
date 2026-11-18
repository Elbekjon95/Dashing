import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { COOKIE, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Avtorizatsiyadan oʻtmaganlar kirish sahifasiga yoʻnaltiriladi.
export default async function Page() {
  const c = await cookies();
  if (!verifyToken(c.get(COOKIE)?.value)) redirect("/login");
  return <Dashboard />;
}