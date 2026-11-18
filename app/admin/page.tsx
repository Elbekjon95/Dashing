import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import UsersAdmin from "@/components/UsersAdmin";
import { COOKIE, verifyToken } from "@/lib/auth";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

// Faqat admin: foydalanuvchilarni boshqarish.
export default async function AdminPage() {
  const c = await cookies();
  const s = verifyToken(c.get(COOKIE)?.value);
  if (!s) redirect("/login");
  if (s.role !== "admin") redirect("/");
  return <UsersAdmin me={s.user} initial={listUsers()} />;
}
