/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useMemo, useState } from "react";
import { N, N1, P, T } from "@/lib/format";
import { Delta, TipRow, todayStr, useDash, useLookups } from "@/lib/dash";
import { OY_T } from "@/lib/static";
import { Card, CompareBars, DataTable, Stats, Tabs } from "../charts";
import { ICONS } from "../UzMap";
import YearCompare, { nz } from "./YearCompare";
import type { Period } from "./YearCompare";

const DAY = 86_400_000;
const ms = (s: string) => Date.parse(s + "T00:00:00Z");
const iso = (t: number) => (Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : "");
const addDays = (s: string, n: number) => iso(ms(s) + n * DAY);
const days = (a: string, b: string) => !Number.isFinite(ms(a)) || !Number.isFinite(ms(b)) ? 0 : Math.round((ms(b) - ms(a)) / DAY) + 1;
const dm = (s: string) => s.slice(8, 10) + "." + s.slice(5, 7);
const dmy = (s: string) => dm(s) + "." + s.slice(0, 4);
const yearBack = (s: string) => { if (!Number.isFinite(ms(s))) return ""; const d = new Date(ms(s)); d.setUTCFullYear(d.getUTCFullYear() - 1); return d.toISOString().slice(0, 10); };

type Preset = { id: string; t: string; r: (today: string) => [string, string] };
const PRESETS: Preset[] = [
  { id: "bugun", t: "Bugun", r: (t) => [t, t] },
  { id: "kecha", t: "Kecha", r: (t) => [addDays(t, -1), addDays(t, -1)] },
  { id: "7", t: "7 kun", r: (t) => [addDays(t, -6), t] },
  { id: "30", t: "30 kun", r: (t) => [addDays(t, -29), t] },
  { id: "oy", t: "Joriy oy", r: (t) => [t.slice(0, 8) + "01", t] },
  { id: "ooy", t: "Oʻtgan oy", r: (t) => { const f = new Date(ms(t.slice(0, 8) + "01")); f.setUTCMonth(f.getUTCMonth() - 1); const from = iso(f.getTime()); return [from, addDays(t.slice(0, 8) + "01", -1)]; } },
  { id: "yil", t: "Yil boshidan", r: (t) => [t.slice(0, 4) + "-01-01", t] },
  { id: "5yil", t: "5 yil", r: (t) => [(+t.slice(0, 4) - 4) + "-01-01", t] },
];

const DATA_START = "2021-01-01"; // 5+ yillik maʼlumotlar boshlanishi

type Res = { a: any; b: any; kunlar: { a: any[]; b: any[] }; ak: any[]; yon: any[]; ap: any[]; sabab: any[]; hozir: string };

export default function StatRange({ children }: { children?: React.ReactNode }) {
  const { D, S } = useDash();
  const { akName, placeName, apLabel, dDesc } = useLookups();
  const today = todayStr(D);
  const [mode, setMode] = useState<"preset" | "custom">("preset"); // tayyor davr YOKI maxsus oraliq — bittasi faol
  const [sync, setSync] = useState(0); // tayyor davr tanlanganda sana maydonlarini yangilash uchun
  const [preset, setPreset] = useState("yil"); // sahifa ochilganda — «Yil boshidan»
  const [from, setFrom] = useState(() => today.slice(0, 4) + "-01-01");
  const [to, setTo] = useState(today);
  const [res, setRes] = useState<Res | null>(null);
  const [done, setDone] = useState<{ from: string; to: string; cf: string; ct: string } | null>(null); // natija qaysi davr uchun hisoblangan
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const [cmpMetr, setCmpMetr] = useState<"pax" | "baj">("pax");

  // solishtiriladigan davr
  const cmp = useMemo<[string, string]>(() => {
    // taqvim bo'yicha mos davr: yil boshidan → o'tgan yilning shu sanasigacha; oy boshidan → o'tgan oyning shu kunigacha
    if (Number.isFinite(ms(from)) && Number.isFinite(ms(to))) {
      if (from.slice(5) === "01-01" && from.slice(0, 4) === to.slice(0, 4)) return [yearBack(from), yearBack(to)];
      if (from.slice(8) === "01" && from.slice(0, 7) === to.slice(0, 7)) {
        const pm = new Date(ms(from)); pm.setUTCMonth(pm.getUTCMonth() - 1);
        const pFrom = iso(pm.getTime()), pLast = addDays(from, -1);
        const pTo = Math.min(+to.slice(8), +pLast.slice(8));
        return [pFrom, pLast.slice(0, 8) + String(pTo).padStart(2, "0")];
      }
    }
    const n = Math.max(1, days(from, to));
    return [addDays(from, -n), addDays(from, -1)];
  }, [from, to]);
  const valid = from >= "2000-01-01" && to >= DATA_START && cmp[0] >= "2000-01-01" && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && ms(from) <= ms(to) && /^\d{4}-\d{2}-\d{2}$/.test(cmp[0]) && /^\d{4}-\d{2}-\d{2}$/.test(cmp[1]) && ms(cmp[0]) <= ms(cmp[1]);

  // har 5 daqiqada qayta hisoblash (joriy davr bugunni oʻz ichiga olsa, raqamlar oʻsib boradi)
  useEffect(() => { const id = setInterval(() => setTick((x) => x + 1), 5 * 60_000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!valid) return;
    const ac = new AbortController();
    const h = setTimeout(async () => {
      setLoading(true); setErr("");
      try {
        const q = new URLSearchParams({ from, to, cfrom: cmp[0], cto: cmp[1], ap: S.ap || "ALL" });
        const r = await fetch("/api/stat?" + q.toString(), { signal: ac.signal, cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Xato " + r.status);
        setRes(j);
        setDone({ from, to, cf: cmp[0], ct: cmp[1] });
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Xato");
      }
      if (!ac.signal.aborted) setLoading(false);
    }, 350);
    return () => { clearTimeout(h); ac.abort(); };
  }, [valid, from, to, cmp, S.ap, tick]);

  const pick = (p: Preset) => { const [a, b] = p.r(today); setPreset(p.id); setFrom(a); setTo(b); setSync((x) => x + 1); };
  const setM = (m: "preset" | "custom") => {
    if (m === mode) return;
    setMode(m);
    if (m === "preset") pick(PRESETS.find((p) => p.id === "yil") || PRESETS[0]); else setPreset("");
  };
  // sana maydoni uncontrolled: kiritish paytida qayta chizilmaydi, shuning uchun kun → oy → yil ketma-ket oʻtadi
  const onDate = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)) set(v); };
  const a = nz(res?.a), b = nz(res?.b);
  const otp = (x: any) => (x && x.ms ? (x.ot / x.ms) * 100 : null);
  const t = (x: any, k: string) => T((x?.[k] || 0));
  const nA = days(from, to), nB = days(cmp[0], cmp[1]);
  const dn = done || { from, to, cf: cmp[0], ct: cmp[1] };
  const rA = Math.max(1, days(dn.from, dn.to));

  // davr bitta yil ichida boʻlsa (oxirgi 3 yildan biri) — shu yil kartasida; aks holda (yillar oraligʻi) — tepada alohida kartalar
  const yF = dn.from.slice(0, 4), yT = dn.to.slice(0, 4), Y0 = +today.slice(0, 4);
  const custom = mode === "custom"; // maxsus oraliq: butun boʻlim faqat shu oraliq maʼlumotlarini koʻrsatadi
  const noCmp = !b.baj && !b.pax; // solishtirish davrida reys yoʻq (masalan, 2024-yildan oldin)
  const noCmpTxt = <span className="rng__nocmp">solishtirish davrida maʼlumot yoʻq</span>;
  const topCards = custom || yF !== yT || +yF < Y0 - 4 || +yF > Y0;

  const pct = (c: number, p: number) => (p ? <Delta cur={c} prev={p} /> : "—");
  const tbl = (rows: any[], name: (k: string) => any, key: "baj" | "pax" | "n", head: string) => (
    <DataTable scroll rows={rows} cols={[
      { h: head, f: (r) => name(r.k) },
      { h: "Joriy", n: true, f: (r) => N(key === "n" ? r.a_n : r["a_" + key]) },
      { h: "Solishtirish", n: true, f: (r) => N(key === "n" ? r.b_n : r["b_" + key]) },
      { h: "Oʻzgarish", n: true, f: (r) => pct(key === "n" ? r.a_n : r["a_" + key], key === "n" ? r.b_n : r["b_" + key]) },
    ]} />
  );
  const two = (rows: any[], name: (k: string) => any, head: string) => (
    <DataTable scroll rows={rows} cols={[
      { h: head, f: (r) => name(r.k) },
      { h: "Reyslar", n: true, f: (r) => N(r.a_baj) },
      { h: "Oldin", n: true, f: (r) => N(r.b_baj) },
      { h: "Yoʻlovchilar", n: true, f: (r) => N(r.a_pax) },
      { h: "Oldin", n: true, f: (r) => N(r.b_pax) },
      { h: "Oʻzgarish", n: true, f: (r) => pct(r.a_pax, r.b_pax) },
    ]} />
  );

  const cmpChart = (
    rows: any[],
    nameFn: (k: string) => string,
    key: "pax" | "baj" | "n",
    opts?: { shareTop?: boolean; searchable?: boolean; placeholder?: string; hiSet?: Set<string> },
  ) => {
    const curK = key === "n" ? "a_n" : "a_" + key;
    const prevK = key === "n" ? "b_n" : "b_" + key;
    const sorted = rows.slice().sort((x, y) => (y[curK] || 0) - (x[curK] || 0));
    const tot = sorted.reduce((s, r) => s + (r[curK] || 0), 0);
    const shareColors = ["var(--c-pri)", "#38bdf8", "var(--c-sec)"];
    const share =
      opts?.shareTop && sorted.length >= 3 && tot > 0
        ? [
            ...sorted.slice(0, 3).map((r, i) => ({ label: r.k, value: r[curK] || 0, color: shareColors[i] })),
            { label: "Boshqalar", value: Math.max(0, tot - sorted.slice(0, 3).reduce((s, r) => s + (r[curK] || 0), 0)), color: "var(--v-line-hi)" },
          ]
        : undefined;
    return (
      <CompareBars
        items={sorted.map((r) => ({
          code: r.k,
          name: nameFn(r.k),
          cur: r[curK] || 0,
          prev: noCmp ? null : r[prevK] || 0,
          highlight: opts?.hiSet ? opts.hiSet.has(r.k) : S.ap === r.k,
          delta: noCmp ? null : pct(r[curK] || 0, r[prevK] || 0),
          sub: key !== "n" ? `Reyslar: ${N(r.a_baj || 0)} · Yoʻlovchi: ${N(r.a_pax || 0)}` : undefined,
          tip: (
            <>
              <div className="h">{r.k}{nameFn(r.k) ? " — " + nameFn(r.k) : ""}</div>
              <TipRow sw="var(--c-pri)" name={key === "n" ? "Joriy" : key === "pax" ? "Yoʻlovchilar" : "Reyslar"} val={N(r[curK] || 0)} />
              {!noCmp ? <TipRow sw="var(--c-sec)" name="Oldingi davr" val={N(r[prevK] || 0)} /> : null}
              {key !== "n" ? <TipRow name={key === "pax" ? "Reyslar" : "Yoʻlovchilar"} val={N(r[key === "pax" ? "a_baj" : "a_pax"] || 0)} /> : null}
            </>
          ),
        }))}
        share={share}
        searchable={opts?.searchable}
        searchPlaceholder={opts?.placeholder}
        maxItems={15}
      />
    );
  };
  const cmpMetrTabs = <Tabs options={[["pax", "Yoʻlovchi"], ["baj", "Reyslar"]]} val={cmpMetr} onPick={(v) => setCmpMetr(v)} />;

  return (
    <>
      <Card title={<span className="rng__ttl">{ICONS.calendar}Davrlarni solishtirish</span>}
        hint="Istalgan sana oraligʻini tanlang — natija bazadan hisoblanadi va tanlangan solishtirish davri bilan taqqoslanadi. Kun — UTC, hisob qoidalari joriy sutka bilan bir xil.">
        <div className="rng">
          <div className="rng__mode">
            <button type="button" className={mode === "preset" ? "on" : ""} onClick={() => setM("preset")}>Tayyor davrlar</button>
            <button type="button" className={mode === "custom" ? "on" : ""} onClick={() => setM("custom")}>Maxsus oraliq</button>
          </div>
          <div className={"rng__presets" + (mode === "custom" ? " is-off" : "")}>
            {PRESETS.map((p) => <button key={p.id} type="button" disabled={mode === "custom"} className={p.id === preset ? "on" : ""} onClick={() => pick(p)}>{p.t}</button>)}
          </div>
          <div className={"rng__row" + (mode === "preset" ? " is-off" : "")}>
            <label>Boshlanishi<input key={"f" + sync} type="date" defaultValue={from} min={DATA_START} max={today} disabled={mode === "preset"} onChange={onDate(setFrom)} /></label>
            <label>Tugashi<input key={"t" + sync} type="date" defaultValue={to} min={DATA_START} max={today} disabled={mode === "preset"} onChange={onDate(setTo)} /></label>
          </div>
          <p className="rng__sum">
            {valid ? <><b>Joriy:</b> {dmy(from)} – {dmy(to)} ({nA} kun{to >= today ? ", bugun kiradi — kun tugallanmagan" : ""}) &nbsp;·&nbsp; <b>Solishtirish:</b> {dmy(cmp[0])} – {dmy(cmp[1])} ({nB} kun)</> : ms(from) > ms(to) ? "Boshlanish sanasi tugash sanasidan keyin boʻlmasin" : to < DATA_START ? "2021-yildan oldingi maʼlumotlar yoʻq" : "Sanalarni toʻgʻri tanlang"}
            {S.ap !== "ALL" ? <> &nbsp;·&nbsp; <b>Aeroport:</b> {apLabel(S.ap)}</> : null}
            {valid && from < DATA_START ? <span className="rng__warn"> · 2021-yildan oldingi maʼlumotlar yoʻq</span> : valid && cmp[0] < DATA_START ? <span className="rng__warn"> · solishtirish davri 2021-yildan oldin — u yerda maʼlumot yoʻq</span> : null}
            {nA !== nB && valid ? <span className="rng__warn"> · davrlar uzunligi har xil ({nA} va {nB} kun)</span> : null}
          </p>
          {err ? <p className="rng__err">{err}</p> : null}
        </div>
      </Card>

      {res && topCards ? (
        <Stats list={[
          { l: "Reyslar", v: N(a.baj), r: noCmp ? noCmpTxt : <><Delta big cur={a.baj} prev={b.baj} /> edi {N(b.baj)}</>, s: "rejada " + N(a.rej) + " · bekor " + N(a.bek) + " · kuniga " + N1(a.baj / rA) },
          { l: "Yoʻlovchilar", v: N(a.pax), r: noCmp ? noCmpTxt : <><Delta big cur={a.pax} prev={b.pax} /> edi {N(b.pax)}</>, s: "uchish " + N(a.pax_dep) + " · qoʻnish " + N(a.pax_arr) },
          { l: "Yuk aylanmasi", v: N1(t(a, "yuk") + t(a, "poc")), u: "t", r: noCmp ? noCmpTxt : <><Delta big cur={a.yuk + a.poc} prev={b.yuk + b.poc} /> edi {N1(t(b, "yuk") + t(b, "poc"))} t</>, s: "yuk " + N1(t(a, "yuk")) + " t · pochta " + N1(t(a, "poc")) + " t · bagaj " + N1(t(a, "bag")) + " t" },
          { l: "Oʻz vaqtida uchish", v: P(a.ms ? a.ot / a.ms : null), r: noCmp ? noCmpTxt : otp(a) != null && otp(b) != null ? <><Delta big pp cur={otp(a)} prev={otp(b)} /> edi {P(b.ms ? b.ot / b.ms : null)}</> : null, s: N(a.dl) + " ta uchish 15 daqiqadan koʻp kechikkan · yoqilgʻi " + N1(t(a, "yoq")) + " t" },
        ]} />
      ) : null}

      {!custom ? <YearCompare period={res ? ({ a, b, from: dn.from, to: dn.to, cf: dn.cf, ct: dn.ct } as Period) : null} /> : null}

      {!res && !err ? <div className="vg__none">{loading ? "Bazadan hisoblanmoqda…" : "Davr tanlang"}</div> : null}

      {res ? (
        <div className={"rng__res" + (loading ? " is-loading" : "")}>
          {loading ? <div className="rng__loading">Bazadan hisoblanmoqda…</div> : null}
          <div className="rng__grid">
            <Card title="Aeroportlar boʻyicha" hint="Reyslar va yoʻlovchilar: joriy davr va solishtirish"
              tools={cmpMetrTabs}
              chart={cmpChart(res.ap || [], apLabel, cmpMetr, { shareTop: true })}
              table={two(res.ap, (k) => <><b>{k}</b><small>{apLabel(k)}</small></>, "Aeroport")} />
            <Card title="Aviakompaniyalar" hint="Eng koʻp 15 tasi"
              tools={cmpMetrTabs}
              chart={cmpChart(res.ak || [], akName, cmpMetr, { shareTop: true, searchable: true, placeholder: "Kod / nom (HY, C6…)", hiSet: new Set(["HY", "C6", "HH", "US", "9S"]) })}
              table={two(res.ak, (k) => <><b>{k}</b><small>{akName(k)}</small></>, "Aviakompaniya")} />
            <Card title="Yoʻnalishlar" hint="Yoʻlovchilar boʻyicha eng katta 15 tasi"
              tools={cmpMetrTabs}
              chart={cmpChart(res.yon || [], placeName, cmpMetr, { searchable: true, placeholder: "Shaharni qidirish…" })}
              table={two(res.yon, (k) => <><b>{k}</b><small>{placeName(k)}</small></>, "Yoʻnalish")} />
            <Card title="Kechikish sabablari" hint="Kechikish kodi qoʻyilgan reyslar soni (eng koʻp 10 ta kod)"
              chart={cmpChart(res.sabab || [], dDesc, "n")}
              table={tbl(res.sabab, (k) => <><b>{k}</b><small>{dDesc(k)}</small></>, "n", "Kod")} />
          </div>
          <p className="rng__note">Hisoblangan vaqt: {res.hozir} UTC · {OY_T[+today.slice(5, 7) - 1]} {today.slice(0, 4)}. Joriy davr bugunni oʻz ichiga olsa, raqamlar har 5 daqiqada yangilanadi.</p>
        </div>
      ) : null}

      {!custom ? children : null}
    </>
  );
}
