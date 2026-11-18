/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AP_LIST, AP_NAME } from "@/lib/static";
import { N } from "@/lib/format";
import { DEFAULT_STATE, DashCtx, TipCtx, type DashData, type DashState } from "@/lib/dash";
import { Tabs } from "./charts";
import { LangSwitch } from "./I18n";
import Bugun from "./tabs/Bugun";
import Stat from "./tabs/Stat";
import Kechikish from "./tabs/Kechikish";
import Avia from "./tabs/Avia";
import Yon from "./tabs/Yon";

const TABS: { id: string; t: string; C: () => ReactNode }[] = [
  { id: "bugun", t: "Dashbord", C: Bugun },
  { id: "stat", t: "Statistika", C: Stat },
  { id: "kechikish", t: "Kechikishlar", C: Kechikish },
  { id: "avia", t: "Aviakompaniyalar", C: Avia },
  { id: "yon", t: "Yoʻnalishlar", C: Yon },
];
const DAVR_TABS = ["kechikish", "avia", "yon"];
const LS_KEY = "dash.s3";

function parseTs(s: string) {
  const m = String(s || "").match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

function Defs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="gTeal" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3fb8a5" /><stop offset="1" stopColor="#0f766e" /></linearGradient>
        <linearGradient id="gOrange" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ffd5a8" /><stop offset="1" stopColor="#f08a3c" /></linearGradient>
        <linearGradient id="gMint" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#cfeee6" /><stop offset="1" stopColor="#8ad4c4" /></linearGradient>
        <linearGradient id="gGrey" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#e3ebea" /><stop offset="1" stopColor="#b7c4c2" /></linearGradient>
        <linearGradient id="gRed" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f3a6a3" /><stop offset="1" stopColor="#d9534f" /></linearGradient>
        <linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2a9d8f" stopOpacity="0.35" /><stop offset="1" stopColor="#2a9d8f" stopOpacity="0" /></linearGradient>
        <linearGradient id="gArc" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#8ad4c4" /><stop offset="1" stopColor="#ffe2bd" /></linearGradient>
        <pattern id="uzm-none" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" className="uzm__hatch" /></pattern>
      </defs>
    </svg>
  );
}

export default function Dashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [D, setD] = useState<DashData | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [S, setS] = useState<DashState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [kiosk, setKiosk] = useState(false);
  const [now, setNow] = useState(0);
  const [pulse, setPulse] = useState(0); // yangi maʼlumot kelganda oshadi — porlash effektini ishga tushiradi
  const [tip, setTip] = useState<{ content: ReactNode; x: number; y: number } | null>(null);
  const tipEl = useRef<HTMLDivElement>(null);
  const appEl = useRef<HTMLDivElement>(null);

  // boshlangʻich holat: saqlangan sozlamalar + manzil (#tab=..&ap=..) + televizor rejimi
  /* eslint-disable react-hooks/set-state-in-effect -- brauzer holati (localStorage, manzil) faqat mijozda oʻqiladi */
  useEffect(() => {
    const init = { ...DEFAULT_STATE };
    try {
      const sv = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      for (const k in sv) if (k in init && k !== "tQ") (init as any)[k] = sv[k];
    } catch {}
    const hm = location.hash.match(/tab=(\w+)/); if (hm) init.tab = hm[1];
    const ham = location.hash.match(/ap=(\w+)/); if (ham) init.ap = ham[1];
    setS(init);
    setKiosk(/(^|[#&])tv\b/.test(location.hash));
    setNow(Date.now());
    setReady(true);
    if (/(^|[#&])glow\b/.test(location.hash)) setTimeout(() => setPulse((x) => x + 1), 900); // #glow — effektni koʻrsatib berish uchun
  }, []);
  useEffect(() => { if (kiosk) document.documentElement.classList.add("kiosk"); else document.documentElement.classList.remove("kiosk"); }, [kiosk]);

  const set = useCallback((p: Partial<DashState>) => {
    setS((s) => {
      const n = { ...s, ...p };
      try { const { tQ, ...rest } = n; void tQ; localStorage.setItem(LS_KEY, JSON.stringify(rest)); } catch {}
      return n;
    });
  }, []);

  // maʼlumotni yuklash: har daqiqada kichik "oʻzgarish bormi?" soʻrovi; server har 5 daqiqada bazadan yangilaydi.
  // Yangi maʼlumot kelsa — kartalar atrofida porlash effekti. Server/baza vaqtincha ishlamasa, oxirgi maʼlumot saqlanib qoladi.
  const verRef = useRef<string | null>(null);
  const firstRef = useRef(true);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/data" + (verRef.current ? "?v=" + encodeURIComponent(verRef.current) : ""), { cache: "no-store" });
      if (r.status === 401) { window.location.href = "/login"; return; } // sessiya tugagan — qayta kirish
      if (!r.ok) throw new Error(String(r.status));
      const nd = await r.json();
      if (!nd.unchanged) {
        verRef.current = nd.meta?.v || null;
        setD(nd);
        if (!firstRef.current) setPulse((x) => x + 1);
        firstRef.current = false;
      }
      setLoadErr(false);
    } catch { setLoadErr(true); }
    setNow(Date.now());
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);

  // yangilanish effekti: #app ga 2.8 soniyaga "refresh" klassi beriladi
  useEffect(() => {
    const el = appEl.current;
    if (!pulse || !el) return;
    el.classList.remove("refresh"); void el.offsetWidth; el.classList.add("refresh");
    const id = setTimeout(() => el.classList.remove("refresh"), 3000);
    return () => clearTimeout(id);
  }, [pulse]);
  // televizor: 1440 px kenglikda chizib, ekranga moslab kattalashtirish
  useEffect(() => {
    const fit = () => {
      const el = appEl.current; if (!el) return;
      const z = Math.max(1, Math.round((window.innerWidth / 1440) * 100) / 100);
      (el.style as any).zoom = String(z);
      el.style.setProperty("--avail", Math.floor(window.innerHeight / z) + "px");
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const logout = useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    window.location.href = "/login";
  }, []);
  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }, []);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if ((e.key === "f" || e.key === "F") && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement as HTMLElement)?.tagName || "")) toggleFs(); };
    document.addEventListener("keydown", kd);
    return () => document.removeEventListener("keydown", kd);
  }, [toggleFs]);

  // tooltip joylashuvi
  useEffect(() => {
    const el = tipEl.current;
    if (!tip || !el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = tip.x + 14, y = tip.y + 14;
    if (x + w > window.innerWidth - 8) x = tip.x - w - 14;
    if (y + h > window.innerHeight - 8) y = tip.y - h - 14;
    el.style.left = Math.max(8, x) + "px"; el.style.top = Math.max(8, y) + "px";
  }, [tip]);
  const tipApi = useMemo(() => ({
    show: (content: ReactNode, e: { clientX: number; clientY: number }) => setTip({ content, x: e.clientX, y: e.clientY }),
    hide: () => setTip(null),
  }), []);

  /* eslint-enable react-hooks/set-state-in-effect */

  const cur = TABS.find((t) => t.id === S.tab) || TABS[0];

  // holat paneli
  const status = useMemo(() => {
    if (!D) return null;
    const q = D.meta?.qismlar || {};
    const ts: string = [q.bugun, q.soatlik, q.tablo].filter(Boolean).sort()[0] || D.meta?.yaratildi;
    const t = parseTs(ts);
    let age = t ? (now - t.getTime()) / 60000 : 1e9;
    const errs: string[] = D.meta?.xatolar || [];
    if (D.meta?.demo) age = 0;
    return { ts, age, errs, demo: !!D.meta?.demo };
  }, [D, now]);

  const ctx = useMemo(() => ({ D, S, set, kiosk }), [D, S, set, kiosk]);

  return (
    <TipCtx.Provider value={tipApi}>
      <Defs />
      <div id="app" ref={appEl}>
        <section className="vg">
          <div className="vg__bar">
            <nav className="vg__nav">
              {TABS.map((t) => (
                <button key={t.id} type="button" className={t.id === cur.id ? "on" : ""} onClick={() => { setTip(null); window.scrollTo(0, 0); set({ tab: t.id }); }}>{t.t}</button>
              ))}
            </nav>
            <div className="vg__bar-right">
              <LangSwitch />
              {isAdmin ? (
                <a className="logoutbtn adminbtn" href="/admin" title="Foydalanuvchilar" aria-label="Foydalanuvchilar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </a>
              ) : null}
              <button type="button" className="logoutbtn" title="Chiqish" aria-label="Chiqish" onClick={logout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
              </button>
              <span>{DAVR_TABS.includes(S.tab) ? <Tabs options={[["d30", "Oxirgi 30 kun"], ["ytd", "Yil boshidan"]]} val={S.davr} onPick={(v) => set({ davr: v })} /> : null}</span>
              <select aria-label="Aeroport" value={S.ap} onChange={(e) => set({ ap: e.target.value })}>
                <option value="ALL">Barcha aeroportlar</option>
                {AP_LIST.map((a) => <option key={a} value={a}>{AP_NAME[a]} ({a})</option>)}
              </select>
            </div>
          </div>

          <div>
            {status?.demo ? <div className="vg__banner ogoh"><b>NAMUNA:</b> bu sahifadagi barcha raqamlar soxta (test) maʼlumot — faqat dashbord koʻrinishini tanishtirish uchun.</div> : null}
            {status && status.age > 40 ? (
              <div className="vg__banner ogoh">Maʼlumotlar {status.age > 1440 ? N(status.age / 1440) + " kun" : status.age > 90 ? N(status.age / 60) + " soat" : N(status.age) + " daqiqa"} oldin yangilangan. Eksport vazifasi ishlayotganini tekshiring (data\eksport.log).</div>
            ) : null}
            {status && status.errs.length ? <div className="vg__banner">Oxirgi yangilanishda xato: {status.errs.map((e, i) => <span key={i}>{e}<br /></span>)}Avvalgi maʼlumotlar koʻrsatilmoqda.</div> : null}
          </div>

          <main>
            {!ready ? null : D ? (
              <DashCtx.Provider value={ctx}>
                <cur.C />
              </DashCtx.Provider>
            ) : loadErr ? (
              <div className="nodata">
                <h2 style={{ marginTop: 0 }}>Maʼlumot topilmadi</h2>
                <p><code>data.js</code> fayli oʻqilmadi. Eksportni ishga tushiring yoki <code>.env.local</code> ichida <code>DASH_DATA_FILE</code> yoʻlini koʻrsating.</p>
                <p><code>powershell -ExecutionPolicy Bypass -File .\eksport.ps1 -Hammasi</code></p>
                <p>Fayl paydo boʻlgach, sahifa bir daqiqa ichida oʻzi yangilanadi.</p>
              </div>
            ) : <div className="vg__none">Yuklanmoqda…</div>}
          </main>

        </section>
      </div>
      <div id="tip" ref={tipEl} style={{ display: tip ? "block" : "none" }}>{tip?.content}</div>
    </TipCtx.Provider>
  );
}
