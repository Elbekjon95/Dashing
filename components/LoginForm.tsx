"use client";
import { useState, type FormEvent } from "react";
import { LangSwitch } from "./I18n";

// Matnlar oʻzbekcha yoziladi; RU/EN tanlansa, sahifa tarjimoni almashtiradi (lib/i18n-dict.ts).
export default function LoginForm({ configured }: { configured: boolean }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(configured ? "" : "Avtorizatsiya sozlanmagan. Administrator bilan bogʻlaning.");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user, password: pass, remember }) });
      if (r.ok) { window.location.href = "/"; return; }
      const j = await r.json().catch(() => ({}));
      setErr(j.error === "too_many" ? "Juda koʻp urinish. Birozdan keyin qayta urinib koʻring." : j.error === "not_configured" ? "Avtorizatsiya sozlanmagan. Administrator bilan bogʻlaning." : "Login yoki parol notoʻgʻri");
    } catch {
      setErr("Server bilan aloqa yoʻq. Qayta urinib koʻring.");
    }
    setBusy(false);
  };

  return (
    <main className="login">
      <LangSwitch className="login__lang" />
      <form className="login__card" onSubmit={submit} autoComplete="on">
        <div className="login__logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>
        </div>
        <h1>Tizimga kirish</h1>
        <p className="login__sub">Aviatsiya operatsion holat paneli</p>
        <label>
          <span>Foydalanuvchi nomi</span>
          <input name="username" type="text" autoComplete="username" autoFocus required value={user} onChange={(e) => setUser(e.target.value)} disabled={!configured} />
        </label>
        <label>
          <span>Parol</span>
          <input name="password" type="password" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} disabled={!configured} />
        </label>
        <label className="login__remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Meni eslab qol (30 kun)</span>
        </label>
        {err ? <p className="login__err" role="alert">{err}</p> : null}
        <button type="submit" disabled={busy || !configured}>{busy ? "Tekshirilmoqda…" : "Kirish"}</button>
      </form>
    </main>
  );
}