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
          { year: y2, ytd: B.a, full: B.b, daily: B.kunlar.a },
          { year: y1, ytd: A.b, full: C.a, daily: A.kunlar.b },
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
  const NM = Number(today.slice(5, 7));
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
  const mTips = OY_T.slice(0, NM).map((m, i) => (i === NM - 1 ? m + " (" + "01–" + upTo.slice(0, 2) + " gacha)" : m));

  return (
    <Card title={<span className="rng__ttl">{ICONS.calendar}Yillar boʻyicha solishtirish</span>}
      hint={`Har yil 1-yanvardan boshlab toʻplangan jami; barcha yillar ${upTo} sanagacha kesilgan. Hozirgi yil oʻtgan yillarning aynan shu paytiga nisbatan oldinda yoki ortda ekanini koʻrsatadi.`}
      tools={<Tabs options={[["pax", "Yoʻlovchilar"], ["baj", "Reyslar"]]} val={metric} onPick={(v) => setMetric(v)} />}>
      {err ? <p className="rng__err">{err}</p> : null}
      {!rows && !err ? <div className="vg__none">{loading ? "Bazadan hisoblanmoqda…" : ""}</div> : null}
      {rows ? (
        <div className={"rng__res" + (loading ? " is-loading" : "")}>
          <div className="yc__grid">
            {[r2, r1, r0].map((r, i) => {
              const cur = r.year === r0.year, prev = i > 0 ? [r2, r1, r0][i - 1] : null;
              const v = (x: any) => (x ? x[key] : 0);
              const diff = (c: number, p: number) => (c - p >= 0 ? "+" : "−") + N(Math.abs(c - p));
              const stats: [string, string, any, any][] = [
                ["Reyslar", N(r.ytd.baj), r.ytd.baj, prev?.ytd.baj],
                ["Yoʻlovchilar", N(r.ytd.pax), r.ytd.pax, prev?.ytd.pax],
                ["Yuk, t", N1(cargo(r.ytd)), cargo(r.ytd), prev ? cargo(prev.ytd) : null],
              ];
              return (
                <div key={r.year} className={"yc__card" + (cur ? " yc__card--cur" : "")}>
                  <div className="yc__head"><b>{r.year}</b><span className="yc__tag">{cur ? "Hozircha" : "Yil boshidan"}</span></div>
                  <div className="yc__big">{N(v(r.ytd))}<small>{word}</small></div>
                  <div className="yc__range">{"01.01 – " + upTo}</div>
                  {cur ? (
                    <div className="yc__vs">
                      {[r1, r2].map((o) => (
                        <div key={o.year} className="yc__vsrow"><span>{"vs " + o.year}</span><Delta big cur={v(r0.ytd)} prev={v(o.ytd)} /><em>{diff(v(r0.ytd), v(o.ytd))}</em></div>
                      ))}
                    </div>
                  ) : (
                    <div className="yc__vs">
                      <div className="yc__vsrow"><span>Butun yil</span><b>{N(v(r.full))}</b></div>
                      {prev ? <div className="yc__vsrow"><span>{"vs " + prev.year}</span><Delta big cur={v(r.ytd)} prev={v(prev.ytd)} /></div> : null}
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
            <div className="yc__ct">Oylar boʻyicha <small>{"01.01 – " + upTo + ", har yil uchun"}</small></div>
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
