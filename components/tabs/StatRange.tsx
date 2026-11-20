/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useMemo, useState } from "react";
import { N, N1, P, T } from "@/lib/format";
import { Delta, todayStr, useDash, useLookups } from "@/lib/dash";
import { OY_T } from "@/lib/static";
import { Card, DataTable, Lines, Stats, Tabs } from "../charts";
import { ICONS } from "../UzMap";
import YearCompare from "./YearCompare";

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
  { id: "oyil", t: "Oʻtgan yil", r: (t) => [(+t.slice(0, 4) - 1) + "-01-01", (+t.slice(0, 4) - 1) + "-12-31"] },
];

type Res = { a: any; b: any; kunlar: { a: any[]; b: any[] }; ak: any[]; yon: any[]; ap: any[]; sabab: any[]; hozir: string };

export default function StatRange() {
  const { D, S } = useDash();
  const { akName, placeName, apLabel, dDesc } = useLookups();
  const today = todayStr(D);
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(() => addDays(today, -29));
  const [to, setTo] = useState(today);
  const [metric, setMetric] = useState<"baj" | "pax">("baj");
  const [res, setRes] = useState<Res | null>(null);
  const [done, setDone] = useState<{ from: string; to: string; cf: string; ct: string } | null>(null); // natija qaysi davr uchun hisoblangan
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);

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
  const valid = from >= "2000-01-01" && cmp[0] >= "2000-01-01" && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && ms(from) <= ms(to) && /^\d{4}-\d{2}-\d{2}$/.test(cmp[0]) && /^\d{4}-\d{2}-\d{2}$/.test(cmp[1]) && ms(cmp[0]) <= ms(cmp[1]);

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

  const pick = (p: Preset) => { const [a, b] = p.r(today); setPreset(p.id); setFrom(a); setTo(b); };
  const a = res?.a, b = res?.b;
  const nA = days(from, to), nB = days(cmp[0], cmp[1]);
  const dn = done || { from, to, cf: cmp[0], ct: cmp[1] };
  const rA = Math.max(1, days(dn.from, dn.to)), rB = Math.max(1, days(dn.cf, dn.ct));
  const otp = (x: any) => (x && x.ms ? (x.ot / x.ms) * 100 : null);
  const t = (x: any, k: string) => T((x?.[k] || 0));

  // kunlar boʻyicha grafik: ikkala davr kun tartibi boʻyicha tekislanadi
  const L = Math.max(res?.kunlar.a.length ? rA : 0, res?.kunlar.b.length ? rB : 0);
  const mapDays = (rows: any[], start: string, n: number) => {
    const m: Record<string, number> = {}; rows.forEach((r) => { m[r[0]] = metric === "baj" ? r[1] : r[2]; });
    return Array.from({ length: n }, (_, i) => { const d = addDays(start, i); return d in m ? m[d] : 0; });
  };
  const va = res ? mapDays(res.kunlar.a, dn.from, rA) : [], vb = res ? mapDays(res.kunlar.b, dn.cf, rB) : [];
  const idx = Array.from({ length: Math.max(rA, rB) }, (_, i) => i);
  const labels = idx.map((i) => (i < rA ? dm(addDays(dn.from, i)) : ""));
  const tips = idx.map((i) => (i < rA ? dmy(addDays(dn.from, i)) : "—") + " | " + (i < rB ? dmy(addDays(dn.cf, i)) : "—"));
  const pad = (v: number[]) => idx.map((i) => (i < v.length ? v[i] : null));

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

  return (
    <>
      <Card title={<span className="rng__ttl">{ICONS.calendar}Davrlarni solishtirish</span>}
        hint="Istalgan sana oraligʻini tanlang — natija bazadan hisoblanadi va tanlangan solishtirish davri bilan taqqoslanadi. Kun — UTC, hisob qoidalari joriy sutka bilan bir xil.">
        <div className="rng">
          <div className="rng__presets">
            {PRESETS.map((p) => <button key={p.id} type="button" className={p.id === preset ? "on" : ""} onClick={() => pick(p)}>{p.t}</button>)}
          </div>
          <div className="rng__row">
            <label>Boshlanishi<input type="date" value={from} max={to} onChange={(e) => { if (!e.target.value) return; setPreset(""); setFrom(e.target.value); }} /></label>
            <label>Tugashi<input type="date" value={to} min={from} max={today} onChange={(e) => { if (!e.target.value) return; setPreset(""); setTo(e.target.value); }} /></label>
          </div>
          <p className="rng__sum">
            {valid ? <><b>Joriy:</b> {dmy(from)} – {dmy(to)} ({nA} kun{to >= today ? ", bugun kiradi — kun tugallanmagan" : ""}) &nbsp;·&nbsp; <b>Solishtirish:</b> {dmy(cmp[0])} – {dmy(cmp[1])} ({nB} kun)</> : "Sanalarni toʻgʻri tanlang"}
            {S.ap !== "ALL" ? <> &nbsp;·&nbsp; <b>Aeroport:</b> {apLabel(S.ap)}</> : null}
            {nA !== nB && valid ? <span className="rng__warn"> · davrlar uzunligi har xil ({nA} va {nB} kun)</span> : null}
          </p>
          {err ? <p className="rng__err">{err}</p> : null}
        </div>
      </Card>

      {!res ? <YearCompare /> : null}

      {!res && !err ? <div className="vg__none">{loading ? "Bazadan hisoblanmoqda…" : "Davr tanlang"}</div> : null}

      {res ? (
        <div className={"rng__res" + (loading ? " is-loading" : "")}>
          {loading ? <div className="rng__loading">Bazadan hisoblanmoqda…</div> : null}
          <Stats list={[
            { l: "Reyslar", v: N(a.baj), r: <><Delta big cur={a.baj} prev={b.baj} /> edi {N(b.baj)}</>, s: "rejada " + N(a.rej) + " · bekor " + N(a.bek) + " · kuniga " + N1(a.baj / rA) },
            { l: "Yoʻlovchilar", v: N(a.pax), r: <><Delta big cur={a.pax} prev={b.pax} /> edi {N(b.pax)}</>, s: "uchish " + N(a.pax_dep) + " · qoʻnish " + N(a.pax_arr) },
            { l: "Yuk aylanmasi", v: N1(t(a, "yuk") + t(a, "poc")), u: "t", r: <><Delta big cur={a.yuk + a.poc} prev={b.yuk + b.poc} /> edi {N1(t(b, "yuk") + t(b, "poc"))} t</>, s: "yuk " + N1(t(a, "yuk")) + " t · pochta " + N1(t(a, "poc")) + " t · bagaj " + N1(t(a, "bag")) + " t" },
            { l: "Oʻz vaqtida uchish", v: P(a.ms ? a.ot / a.ms : null), r: otp(a) != null && otp(b) != null ? <><Delta big pp cur={otp(a)} prev={otp(b)} /> edi {P(b.ms ? b.ot / b.ms : null)}</> : null, s: N(a.dl) + " ta uchish 15 daqiqadan koʻp kechikkan · yoqilgʻi " + N1(t(a, "yoq")) + " t" },
          ]} />

          <Card title="Kunlar boʻyicha taqqoslash" hint="Ikkala davr kun tartibi boʻyicha ustma-ust qoʻyilgan: 1-kun 1-kun bilan, 2-kun 2-kun bilan"
            tools={<Tabs options={[["baj", "Reyslar"], ["pax", "Yoʻlovchilar"]]} val={metric} onPick={(v) => setMetric(v)} />}
            chart={L ? <Lines labels={labels} tips={tips} fmt={N} h={260} labelW={52} series={[{ name: "Joriy davr", fill: "teal", values: pad(va), area: true, dots: rA <= 45 }, { name: "Solishtirish davri", fill: "orange", values: pad(vb), w: 2, dots: false }]} /> : <div className="vg__none">Maʼlumot yoʻq</div>} />

          <YearCompare />

          <div className="rng__grid">
            <Card title="Aeroportlar boʻyicha" hint="Reyslar va yoʻlovchilar: joriy davr va solishtirish">{two(res.ap, (k) => <><b>{k}</b><small>{apLabel(k)}</small></>, "Aeroport")}</Card>
            <Card title="Aviakompaniyalar" hint="Eng koʻp 15 tasi">{two(res.ak, (k) => <><b>{k}</b><small>{akName(k)}</small></>, "Aviakompaniya")}</Card>
            <Card title="Yoʻnalishlar" hint="Yoʻlovchilar boʻyicha eng katta 15 tasi">{two(res.yon, (k) => <><b>{k}</b><small>{placeName(k)}</small></>, "Yoʻnalish")}</Card>
            <Card title="Kechikish sabablari" hint="Kechikish kodi qoʻyilgan reyslar soni (eng koʻp 10 ta kod)">{tbl(res.sabab, (k) => <><b>{k}</b><small>{dDesc(k)}</small></>, "n", "Kod")}</Card>
          </div>
          <p className="rng__note">Hisoblangan vaqt: {res.hozir} UTC · {OY_T[+today.slice(5, 7) - 1]} {today.slice(0, 4)}. Joriy davr bugunni oʻz ichiga olsa, raqamlar har 5 daqiqada yangilanadi.</p>
        </div>
      ) : null}
    </>
  );
}
