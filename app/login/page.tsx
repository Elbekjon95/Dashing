import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { COOKIE, authConfigured, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const c = await cookies();
  if (verifyToken(c.get(COOKIE)?.value)) redirect("/");
  return <LoginForm configured={authConfigured()} />;
}