/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { N, N1, P, T } from "@/lib/format";
import { Delta, todayStr, useDash } from "@/lib/dash";
import { Bars, Card, Tabs } from "../charts";
import { OY, OY_T } from "@/lib/static";
import { ICONS } from "../UzMap";

const dm = (s: string) => s.slice(8, 10) + "." + s.slice(5, 7);
const dmy = (s: string) => dm(s) + "." + s.slice(0, 4);
const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
// sanani n yil oldinga/orqaga suramiz (29-fevral boʻlmagan yilda 28-fevral)
const shiftYear = (s: string, n: number) => {
  const y = +s.slice(0, 4) + n, md = s.slice(5);
  return (md === "02-29" && !leap(y) ? y + "-02-28" : y + "-" + md);
};

export type Period = { a: any; b: any; from: string; to: string; cf: string; ct: string };
// maʼlumot boʻlmagan davr uchun baza null qaytarishi mumkin — nollar bilan almashtiramiz
export const ZERO = { baj: 0, rej: 0, bek: 0, pax: 0, pax_dep: 0, pax_arr: 0, yuk: 0, poc: 0, bag: 0, yoq: 0, ms: 0, ot: 0, dl: 0 };
export const nz = (x: any) => x || ZERO;

type Y = { year: number; ytd: any; full: any; daily: any[] };

export default function YearCompare({ period }: { period?: Period | null }) {
  const { D, S, set } = useDash();
  const today = todayStr(D);
  const Y0 = +today.slice(0, 4);
  const [rows, setRows] = useState<Y[] | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const metric = S.metr; // Reyslar / Yoʻlovchilar / Yuk — sahifadagi barcha pastki kartalar bilan umumiy

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
          { year: y2, ytd: nz(B.a), full: nz(B.b), daily: B.kunlar?.b || [] },
          { year: y1, ytd: nz(A.b), full: nz(C.a), daily: C.kunlar?.a || [] },
          { year: Y0, ytd: nz(A.a), full: null, daily: A.kunlar?.a || [] },
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
    y.daily.forEach((r: any) => { const m = +String(r[0]).slice(5, 7) - 1; if (m >= 0 && m < NM) out[m] += (metric === "baj" ? r[1] : metric === "pax" ? r[2] : T(r[3] || 0)) || 0; });
    return out;
  };
  const mf = (n: number) => (metric === "yuk" ? N1(n) : N(n));
  const [r2, r1, r0] = rows || [];
  const upTo = dm(today);
  const mLabels = OY.slice(0, NM);
  const mTips = OY_T.slice(0, NM).map((m, i) => (i === curM ? m + " (01–" + upTo.slice(0, 2) + " gacha)" : m));

  return (
    <Card title={<span className="rng__ttl">{ICONS.calendar}Yillar boʻyicha solishtirish</span>}
      hint={`Oʻtgan yillar — toʻliq yil boʻyicha, joriy yil — 1-yanvardan ${upTo} sanagacha. Joriy yilning oʻtgan yillar bilan solishtirishi aynan shu sanagacha hisoblanadi.`}>
      {err ? <p className="rng__err">{err}</p> : null}
      {!rows && !err ? <div className="vg__none">{loading ? "Bazadan hisoblanmoqda…" : ""}</div> : null}
      {rows ? (
        <div className={"rng__res" + (loading ? " is-loading" : "")}>
          <div className="yc__grid">
            {[r2, r1, r0].map((r, i) => {
              const cur = r.year === r0.year, prev = i > 0 ? [r2, r1, r0][i - 1] : null;
              const v = (x: any) => (x ? x.baj : 0); // kartalarda asosiy koʻrsatkich — reyslar; qolganlari pastdagi jadvalda
              // tanlangan davr bitta yil ichida boʻlsa — aynan shu yil kartasida koʻrsatiladi; boshqa kartalar oʻz holicha
              const sel = !!period && period.from.slice(0, 4) === String(r.year) && period.to.slice(0, 4) === String(r.year);
              const cd = sel ? period!.a : cur ? r.ytd : r.full;
              const pd = sel ? period!.b : cur ? prev?.ytd : prev?.full;
              const diff = (c: number, p: number) => (c - p >= 0 ? "+" : "−") + N(Math.abs(c - p));
              const otp = (x: any) => (x && x.ms ? (x.ot / x.ms) * 100 : null);
              const stats: [string, string, any, any, boolean?][] = [
                ["Reyslar", N(cd.baj), cd.baj, pd ? pd.baj : null],
                ["Yoʻlovchilar", N(cd.pax), cd.pax, pd ? pd.pax : null],
                ["Yuk, t", N1(cargo(cd)), cargo(cd), pd ? cargo(pd) : null],
                ["Oʻz vaqtida uchish", P(cd.ms ? cd.ot / cd.ms : null), otp(cd), otp(pd), true],
              ];
              return (
                <div key={r.year} className={"yc__card" + (cur || sel ? " yc__card--cur" : "")}>
                  <div className="yc__head"><b>{r.year}</b>{sel ? null : <span className="yc__tag">{cur ? "Hozircha" : "Butun yil"}</span>}</div>
                  <div className="yc__big">{N(v(cd))}<small>reys</small></div>
                  <div className="yc__range">{sel ? dmy(period!.from) + " – " + dmy(period!.to) : cur ? "01.01 – " + upTo : "01.01 – 31.12"}</div>
                  {sel ? (
                    <div className="yc__vs">
                      <div className="yc__vsrow"><span>{"vs " + dmy(period!.cf) + " – " + dmy(period!.ct)}</span><Delta big cur={v(period!.a)} prev={v(period!.b)} /><em>{diff(v(period!.a), v(period!.b))}</em></div>
                    </div>
                  ) : cur ? (
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
                    {stats.map(([l, t, c, pv, pp]) => (
                      <div key={l}><span>{l}</span><b>{t}</b>{pv != null ? <Delta cur={c} prev={pv} pp={pp} /> : null}</div>
                    ))}
                  </div>
                  {sel ? (
                    <p className="yc__note">
                      {"rejada " + N(cd.rej) + " · bekor " + N(cd.bek) + " · uchish " + N(cd.pax_dep) + " · qoʻnish " + N(cd.pax_arr)}<br />
                      {N(cd.dl) + " ta uchish 15 daqiqadan koʻp kechikkan · yoqilgʻi " + N1(T(cd.yoq || 0)) + " t"}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="yc__chart">
            <div className="yc__ct">
              <span>Oylar boʻyicha <small>{"har yil uchun · " + r0.year + " — " + upTo + " gacha"}</small></span>
              <Tabs options={[["baj", "Reyslar"], ["pax", "Yoʻlovchilar"], ["yuk", "Yuk va pochta"]]} val={metric} onPick={(v) => set({ metr: v })} />
            </div>
            <Bars labels={mLabels} tips={mTips} fmt={mf} fmtAxis={(v) => (metric === "yuk" ? (v >= 1e3 ? N1(v / 1e3) + " ming" : N(v)) : v >= 1e6 ? N1(v / 1e6) + " mln" : v >= 1e3 ? N(v / 1e3) + " ming" : N(v))} h={290} labelW={52} series={[
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
