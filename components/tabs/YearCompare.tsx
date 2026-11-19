/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { N, N1, T } from "@/lib/format";
import { Delta, todayStr, useDash } from "@/lib/dash";
import { Bars, Card, Tabs } from "../charts";
import { OY, OY_T } from "@/lib/static";
import { ICONS } from "../UzMap";

const dm = (s: string) => s.slice(8, 10) + "." + s.slice(5, 7);
const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
// sanani n yil oldinga/orqaga suramiz (29-fevral boʻlmagan yilda 28-fevral)
const shiftYear = (s: string, n: number) => {
  const y = +s.slice(0, 4) + n, md = s.slice(5);
  return (md === "02-29" && !leap(y) ? y + "-02-28" : y + "-" + md);
};

type Y = { year: number; ytd: any; full: any; daily: any[] };

export default function YearCompare() {
  const { D, S } = useDash();
  const today = todayStr(D);
  const Y0 = +today.slice(0, 4);
  const [rows, setRows] = useState<Y[] | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<"baj" | "pax">("pax");

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return;
    const ac = new AbortController();
    const h0 = setTimeout(() => { setLoading(true); setErr(""); }, 0);
    const get = async (from: string, to: string, cfrom: string, cto: string) => {
      const q = new URLSearchParams({ from, to, cfrom, cto, ap: S.ap || "ALL" });
      const r = await fetch("/api/stat?" + q.toString(), { signal: ac.signal, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Xato " + r.status);
      return j;
    };
    const y1 = Y0 - 1, y2 = Y0 - 2;
    (async () => {
      try {
        // A: joriy yil (boshidan bugungacha) va oʻtgan yilning shu sanagacha; B: 2 yil oldin shu sanagacha va butun yil; C: oʻtgan yil butun
        const [A, B, C] = await Promise.all([
          get(Y0 + "-01-01", today, y1 + "-01-01", shiftYear(today, -1)),
          get(y2 + "-01-01", shiftYear(today, -2), y2 + "-01-01", y2 + "-12-31"),
          get(y1 + "-01-01", y1 + "-12-31", y1 + "-01-01", y1 + "-12-31"),
        ]);
        setRows([
          { year: y2, ytd: B.a, full: B.b, daily: B.kunlar.b },
          { year: y1, ytd: A.b, full: C.a, daily: C.kunlar.a },
          { year: Y0, ytd: A.a, full: null, daily: A.kunlar.a },
        ]);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Xato");
      }
      if (!ac.signal.aborted) setLoading(false);
    })();
    return () => { clearTimeout(h0); ac.abort(); };
  }, [today, S.ap, Y0]);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const cargo = (x: any) => (x ? T((x.yuk || 0) + (x.poc || 0)) : null);
  const NM = 12; // har doim 12 oy; kelajak oylar 0 boʻlib turadi, maʼlumot paydo boʻlishi bilan toʻlib boradi
  const curM = Number(today.slice(5, 7)) - 1;
  const byMonth = (y: Y) => {
    const out = Array.from({ length: NM }, () => 0);
    y.daily.forEach((r: any) => { const m = +String(r[0]).slice(5, 7) - 1; if (m >= 0 && m < NM) out[m] += (metric === "baj" ? r[1] : r[2]) || 0; });
    return out;
  };
  const key = metric === "baj" ? "baj" : "pax";
  const word = metric === "baj" ? "reys" : "yoʻlovchi";
  const [r2, r1, r0] = rows || [];
  const upTo = dm(today);
  const mLabels = OY.slice(0, NM);
  const mTips = OY_T.slice(0, NM).map((m, i) => (i === curM ? m + " (01–" + upTo.slice(0, 2) + " gacha)" : m));

  return (
    <Card title={<span className="rng__ttl">{ICONS.calendar}Yillar boʻyicha solishtirish</span>}
      hint={`Oʻtgan yillar — toʻliq yil boʻyicha, joriy yil — 1-yanvardan ${upTo} sanagacha. Joriy yilning oʻtgan yillar bilan solishtirishi aynan shu sanagacha hisoblanadi.`}
      tools={<Tabs options={[["pax", "Yoʻlovchilar"], ["baj", "Reyslar"]]} val={metric} onPick={(v) => setMetric(v)} />}>
      {err ? <p className="rng__err">{err}</p> : null}
      {!rows && !err ? <div className="vg__none">{loading ? "Bazadan hisoblanmoqda…" : ""}</div> : null}
      {rows ? (
        <div className={"rng__res" + (loading ? " is-loading" : "")}>
          <div className="yc__grid">
            {[r2, r1, r0].map((r, i) => {
              const cur = r.year === r0.year, prev = i > 0 ? [r2, r1, r0][i - 1] : null;
              const v = (x: any) => (x ? x[key] : 0);
              const cmp = (y: Y) => (cur ? y.ytd : y.full); // joriy yilning oʻzgarishi — oʻtgan yilning shu sanagacha boʻlgan qiymatiga nisbatan
              const src = (y: Y) => (y.year === r0.year ? y.ytd : y.full); // oʻtgan yillar — toʻliq yil, joriy yil — hozirgacha
              const diff = (c: number, p: number) => (c - p >= 0 ? "+" : "−") + N(Math.abs(c - p));
              const stats: [string, string, any, any][] = [
                ["Reyslar", N(src(r).baj), src(r).baj, prev ? cmp(prev).baj : null],
                ["Yoʻlovchilar", N(src(r).pax), src(r).pax, prev ? cmp(prev).pax : null],
                ["Yuk, t", N1(cargo(src(r))), cargo(src(r)), prev ? cargo(cmp(prev)) : null],
              ];
              return (
                <div key={r.year} className={"yc__card" + (cur ? " yc__card--cur" : "")}>
                  <div className="yc__head"><b>{r.year}</b><span className="yc__tag">{cur ? "Hozircha" : "Butun yil"}</span></div>
                  <div className="yc__big">{N(v(src(r)))}<small>{word}</small></div>
                  <div className="yc__range">{cur ? "01.01 – " + upTo : "01.01 – 31.12"}</div>
                  {cur ? (
                    <div className="yc__vs">
                      {[r1, r2].map((o) => (
                        <div key={o.year} className="yc__vsrow"><span>{"vs " + o.year + " (01.01 – " + upTo + ")"}</span><Delta big cur={v(r0.ytd)} prev={v(o.ytd)} /><em>{diff(v(r0.ytd), v(o.ytd))}</em></div>
                      ))}
                    </div>
                  ) : (
                    <div className="yc__vs">
                      {prev ? <div className="yc__vsrow"><span>{"vs " + prev.year}</span><Delta big cur={v(r.full)} prev={v(prev.full)} /></div> : null}
                    </div>
                  )}
                  <div className="yc__mini">
                    {stats.map(([l, t, c, pv]) => (
                      <div key={l}><span>{l}</span><b>{t}</b>{prev && pv != null ? <Delta cur={c} prev={pv} /> : null}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="yc__chart">
            <div className="yc__ct">Oylar boʻyicha <small>{"har yil uchun · " + r0.year + " — " + upTo + " gacha"}</small></div>
            <Bars labels={mLabels} tips={mTips} fmt={N} fmtAxis={(v) => (v >= 1e6 ? N1(v / 1e6) + " mln" : v >= 1e3 ? N(v / 1e3) + " ming" : N(v))} h={290} labelW={52} series={[
              { name: String(r2.year), fill: "grey", values: byMonth(r2) },
              { name: String(r1.year), fill: "orange", values: byMonth(r1) },
              { name: String(r0.year), fill: "teal", values: byMonth(r0) },
            ]} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
