"use client";
import { useState, type FormEvent } from "react";
import { LangSwitch } from "./I18n";
import UzAirportsLogo from "./UzAirportsLogo";

// Matnlar oʻzbekcha yoziladi; RU/EN tanlansa, sahifa tarjimoni almashtiradi (lib/i18n-dict.ts).
// setup=true: tizimda hali foydalanuvchi yoʻq — birinchi roʻyxatdan oʻtgan foydalanuvchi admin boʻladi.
export default function LoginForm({ configured, setup = false }: { configured: boolean; setup?: boolean }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(configured ? "" : "Avtorizatsiya sozlanmagan. Administrator bilan bogʻlaning.");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (setup && pass !== pass2) { setErr("Parollar bir xil emas"); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(setup ? "/api/auth/setup" : "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user, password: pass, remember }) });
      if (r.ok) { window.location.href = "/"; return; }
      const j = await r.json().catch(() => ({}));
      setErr(j.error === "bad_username" ? "Login 3–32 belgi: kichik lotin harflari, raqamlar, nuqta, chiziq" : j.error === "weak_password" ? "Parol kamida 10 belgidan iborat boʻlsin" : j.error === "already_setup" ? "Administrator allaqachon yaratilgan. Sahifani yangilang." : j.error === "too_many" ? "Juda koʻp urinish. Birozdan keyin qayta urinib koʻring." : j.error === "not_configured" ? "Avtorizatsiya sozlanmagan. Administrator bilan bogʻlaning." : "Login yoki parol notoʻgʻri");
    } catch {
      setErr("Server bilan aloqa yoʻq. Qayta urinib koʻring.");
    }
    setBusy(false);
  };

  return (
    <main className="login">
      <svg className="login__bg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="lgArc1" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#3b82f6" stopOpacity="0" /><stop offset="0.5" stopColor="#3b82f6" stopOpacity="0.45" /><stop offset="1" stopColor="#93c5fd" stopOpacity="0" /></linearGradient>
          <linearGradient id="lgArc2" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#38bdf8" stopOpacity="0" /><stop offset="0.5" stopColor="#e2e8f0" stopOpacity="0.35" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
        </defs>
        <g fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="1">
          <circle cx="720" cy="450" r="180" />
          <circle cx="720" cy="450" r="290" strokeDasharray="4 6" />
          <circle cx="720" cy="450" r="410" />
          <circle cx="720" cy="450" r="540" strokeDasharray="2 8" />
          <circle cx="720" cy="450" r="680" />
        </g>
        <path d="M 110 620 Q 520 340 1320 580" fill="none" stroke="url(#lgArc1)" strokeWidth="1.6" />
        <path d="M 180 420 Q 720 180 1280 440" fill="none" stroke="url(#lgArc2)" strokeWidth="1.4" />
        <circle cx="420" cy="410" r="3" fill="#3b82f6" opacity="0.8" />
        <circle cx="1010" cy="340" r="3.5" fill="#93c5fd" opacity="0.85" />
        <circle cx="1180" cy="520" r="2.5" fill="#ffffff" opacity="0.7" />
      </svg>
      <LangSwitch className="login__lang" />
      <form className="login__card" onSubmit={submit} autoComplete="on">
        <div className="login__logo">
          <UzAirportsLogo variant="full" />
        </div>
        <h1>{setup ? "Administratorni yaratish" : "Tizimga kirish"}</h1>
        <p className="login__sub">{setup ? "Birinchi foydalanuvchi administrator boʻladi va keyin boshqa foydalanuvchilarni qoʻshadi" : "Aviatsiya operatsion holat paneli"}</p>
        <label>
          <span>Foydalanuvchi nomi</span>
          <input name="username" type="text" autoComplete="username" autoFocus required value={user} onChange={(e) => setUser(e.target.value)} disabled={!configured} />
        </label>
        <label>
          <span>Parol</span>
          <input name="password" type="password" autoComplete={setup ? "new-password" : "current-password"} required minLength={setup ? 10 : undefined} value={pass} onChange={(e) => setPass(e.target.value)} disabled={!configured} />
        </label>
        {setup ? (
          <label>
            <span>Parolni takrorlang</span>
            <input name="password2" type="password" autoComplete="new-password" required value={pass2} onChange={(e) => setPass2(e.target.value)} disabled={!configured} />
          </label>
        ) : null}
        <label className="login__remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Meni eslab qol (30 kun)</span>
        </label>
        {err ? <p className="login__err" role="alert">{err}</p> : null}
        <button type="submit" disabled={busy || !configured}>{busy ? "Tekshirilmoqda…" : setup ? "Administrator yaratish" : "Kirish"}</button>
      </form>
    </main>
  );
}