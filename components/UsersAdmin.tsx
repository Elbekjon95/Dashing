"use client";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { LangSwitch } from "./I18n";

type U = { username: string; role: "admin" | "user"; createdAt: string };
type Res = { ok: boolean; status: number; j: { error?: string; users?: U[]; user?: U } };

const ERR: Record<string, string> = {
  bad_username: "Login 3–32 belgi: kichik lotin harflari, raqamlar, nuqta, chiziq",
  weak_password: "Parol kamida 10 belgidan iborat boʻlsin",
  exists: "Bunday foydalanuvchi allaqachon bor",
  last_admin: "Oxirgi administratorni oʻchirib yoki pasaytirib boʻlmaydi",
  self: "Oʻzingizni oʻchira olmaysiz",
  not_found: "Foydalanuvchi topilmadi",
  forbidden: "Ruxsat yoʻq",
};

async function call(method: string, body?: object): Promise<Res> {
  try {
    const r = await fetch("/api/users", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, j: {} };
  }
}

export default function UsersAdmin({ me, initial }: { me: string; initial: U[] }) {
  const [users, setUsers] = useState<U[]>(initial);
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const say = (t: string, bad = false) => setMsg({ t, bad });
  const fail = (r: Res) => say(r.status === 401 ? "Sessiya tugagan. Qayta kiring." : r.status === 0 ? "Server bilan aloqa yoʻq" : ERR[r.j.error || ""] || "Xatolik yuz berdi", true);

  const load = useCallback(async () => {
    const r = await call("GET");
    if (r.ok) setUsers(r.j.users || []);
    else if (r.status === 401 || r.status === 403) window.location.href = "/login";
    else fail(r);
  }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    const r = await call("POST", { username: name, password: pass, role });
    setBusy(false);
    if (!r.ok) return fail(r);
    setName(""); setPass(""); setRole("user");
    say(`«${r.j.user?.username}» qoʻshildi`);
    void load();
  };

  const resetPass = async (u: U) => {
    const p = window.prompt(`«${u.username}» uchun yangi parol (kamida 10 belgi):`);
    if (!p) return;
    const r = await call("PATCH", { username: u.username, password: p });
    if (!r.ok) return fail(r);
    say(`«${u.username}» paroli almashtirildi`);
  };
  const toggleRole = async (u: U) => {
    const next = u.role === "admin" ? "user" : "admin";
    const r = await call("PATCH", { username: u.username, role: next });
    if (!r.ok) return fail(r);
    say(`«${u.username}» endi ${next === "admin" ? "administrator" : "oddiy foydalanuvchi"}`);
    void load();
  };
  const remove = async (u: U) => {
    if (!window.confirm(`«${u.username}» oʻchirilsinmi?`)) return;
    const r = await call("DELETE", { username: u.username });
    if (!r.ok) return fail(r);
    say(`«${u.username}» oʻchirildi`);
    void load();
  };

  return (
    <main className="login adm">
      <LangSwitch className="login__lang" />
      <div className="adm__card">
        <div className="adm__head">
          <h1>Foydalanuvchilar</h1>
          <Link href="/" className="adm__back">← Dashbordga qaytish</Link>
        </div>

        <form className="adm__add" onSubmit={add} autoComplete="off">
          <input type="text" placeholder="Login" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <input type="password" placeholder="Parol (kamida 10 belgi)" required minLength={10} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
          <select value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")} aria-label="Rol">
            <option value="user">Foydalanuvchi</option>
            <option value="admin">Administrator</option>
          </select>
          <button type="submit" disabled={busy}>Qoʻshish</button>
        </form>
        {msg ? <p className={msg.bad ? "login__err" : "adm__ok"} role="status">{msg.t}</p> : null}

        <table className="adm__table">
          <thead><tr><th>Login</th><th>Rol</th><th>Yaratilgan</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.username}>
                <td><b>{u.username}</b>{u.username === me ? <span className="adm__me"> (siz)</span> : null}</td>
                <td>{u.role === "admin" ? "Administrator" : "Foydalanuvchi"}</td>
                <td>{u.createdAt.slice(0, 10)}</td>
                <td className="adm__act">
                  <button type="button" onClick={() => resetPass(u)}>Parolni almashtirish</button>
                  <button type="button" onClick={() => toggleRole(u)} disabled={u.username === me}>{u.role === "admin" ? "Oddiy qilish" : "Admin qilish"}</button>
                  <button type="button" className="adm__del" onClick={() => remove(u)} disabled={u.username === me}>Oʻchirish</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
