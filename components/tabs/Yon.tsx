/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useMemo } from "react";
import { AP_LIST, YON } from "@/lib/static";
import { N, P, sum } from "@/lib/format";
import { Delta, TipRow, davrNom, useDash, useLookups, useSelAp } from "@/lib/dash";
import { Card, CompareBars, DataTable, Rank, Row, Stats, type Col } from "../charts";
import WorldMap from "../WorldMap";

export default function Yon() {
  const { D, S } = useDash();
  const { placeName, country } = useLookups();
  const selAp = useSelAp();
  const p = S.davr, dn = davrNom(p), pk = p === "ytd" ? "ytdo" : "d30o"; // oldingi davr: yil boshidan → oʻtgan yil; 30 kun → oldingi 30 kun

  const g = useMemo(() => {
    const byB: Record<string, any> = {}, byY: Record<string, any> = {}, byC: Record<string, any> = {}, pairs: Record<string, any> = {};
    selAp(D.yonalishlar || []).forEach((r0: any) => {
      const r = r0.yon === "CIS" ? { ...r0, yon: "MVL" } : r0; // MDH ham xalqaro tarkibida
      const o = (byB[r.bosh] = byB[r.bosh] || { b: r.bosh, yon: r.yon, r: 0, p: 0, po: 0, pp: 0 });
      o.r += r["r_" + p]; o.p += r["p_" + p]; o.po += r.p_ytdo; o.pp += r["p_" + pk] || 0;
      const y = (byY[r.yon] = byY[r.yon] || { r: 0, p: 0, pp: 0, rp: 0 });
      y.r += r["r_" + p]; y.p += r["p_" + p]; y.pp += r["p_" + pk] || 0; y.rp += r["r_" + pk] || 0;
      if (r["p_" + p] > 0) { const key = r.ap + ">" + r.bosh; const o = (pairs[key] = pairs[key] || { from: r.ap, to: r.bosh, n: 0, r: 0 }); o.n += r["p_" + p]; o.r += r["r_" + p]; }
    });
    const prevDest = Object.keys(byB).filter((k) => byB[k].pp > 0);
    const list: any[] = Object.keys(byB).map((k) => byB[k]).filter((x) => x.r > 0).sort((a, b) => b.p - a.p || b.r - a.r);
    list.forEach((x) => { const c = country(x.b); const o = (byC[c] = byC[c] || { c, r: 0, p: 0 }); o.r += x.r; o.p += x.p; });
    return { list, byY, byC, prevDest: prevDest.length, prs: Object.keys(pairs).map((k) => pairs[k]) as { from: string; to: string; n: number; r: number }[] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [D, S.ap, p]);
  const { list, byY, byC, prs, prevDest } = g;
  const totP = sum(list, "p");
  const cl: any[] = Object.keys(byC).map((k) => byC[k]).sort((a, b) => b.p - a.p);


  const cols: Col[] = [
    { h: "#", n: true, f: (r) => list.indexOf(r) + 1 },
    { h: "Aeroport", f: (r) => <><b>{r.b}</b><small>{placeName(r.b)}</small></> },
    { h: "Davlat", f: (r) => country(r.b) },
    { h: "Turi", f: (r) => YON[r.yon] || r.yon },
    { h: "Reyslar", n: true, f: (r) => N(r.r) },
    { h: "Yoʻlovchilar", n: true, f: (r) => N(r.p) },
    { h: "Ulush", n: true, f: (r) => P(r.p / (totP || 1)) },
  ];
  if (p === "ytd") cols.push({ h: "Oʻtgan yilga", n: true, f: (r) => <Delta cur={r.p} prev={r.po} /> });

  return (
    <>
      <section className="vg__card vg__globe"><div className="bd"><WorldMap homes={S.ap === "ALL" ? AP_LIST : [S.ap]} pairs={prs} hub={S.ap === "ALL" ? "UZ" : undefined} top={10} unit="yoʻlovchi" fill /></div></section>
      <Stats list={[
        ...["MVL", "VVL"].map((y) => { const o = byY[y] || { r: 0, p: 0, pp: 0, rp: 0 }; return { cls: y === "MVL" ? "vg__stat--cyan" : "vg__stat--emerald", l: YON[y] + " reyslar", v: P(o.p / (totP || 1)), r: o.pp ? <><Delta big cur={o.p} prev={o.pp} /> edi {N(o.pp)}</> : null, s: N(o.p) + " yoʻlovchi · " + N(o.r) + " reys · " + dn }; }),
        { cls: "vg__stat--amber", l: "Yoʻnalishlar", v: N(list.length), r: prevDest ? <><Delta big cur={list.length} prev={prevDest} /> edi {N(prevDest)}</> : null, s: N(Object.keys(byC).length) + " ta davlat · " + dn },
      ]} />
      <Row cls="vg__row--two">
        <Card title="Eng katta yoʻnalishlar" hint={"Yoʻlovchilar boʻyicha top-20 · " + dn}
          chart={<Rank items={list.slice(0, 20).map((x) => ({ code: x.b, sub: placeName(x.b) + " · " + country(x.b), value: x.p, x }))}
            tip={(i) => <><div className="h">{placeName(i.x.b)} ({i.x.b})</div><TipRow name="Davlat" val={country(i.x.b)} /><TipRow name="Yoʻlovchilar" val={N(i.x.p)} /><TipRow name="Reyslar" val={N(i.x.r)} /><TipRow name="Turi" val={YON[i.x.yon] || i.x.yon} /></>} />} />
        <Card title="Davlatlar" hint={"Yoʻlovchilar boʻyicha · " + dn}
          chart={<Rank tone="warm" items={cl.slice(0, 15).map((x) => ({ code: x.c, value: x.p, extra: P(x.p / (totP || 1)) }))} />}
          table={<DataTable scroll rows={cl} cols={[{ h: "Davlat", f: (r) => r.c }, { h: "Yoʻlovchilar", n: true, f: (r) => N(r.p) }, { h: "Reyslar", n: true, f: (r) => N(r.r) }]} />} />
      </Row>
      <Card title="Barcha yoʻnalishlar" hint={dn}
        chart={
          <CompareBars
            searchable
            searchPlaceholder="Yoʻnalishni qidirish…"
            items={list.map((r) => ({
              code: r.b,
              name: `${placeName(r.b)} · ${country(r.b)}`,
              cur: r.p,
              prev: p === "ytd" ? r.po : r.pp || null,
              delta: p === "ytd" ? <Delta cur={r.p} prev={r.po} /> : r.pp ? <Delta cur={r.p} prev={r.pp} /> : <span className="vg__delta vg__delta--same">{P(r.p / (totP || 1))}</span>,
              sub: `${N(r.r)} reys · ${YON[r.yon] || r.yon}`,
              tip: (
                <>
                  <div className="h">{placeName(r.b)} ({r.b})</div>
                  <TipRow name="Davlat" val={country(r.b)} />
                  <TipRow sw="var(--c-pri)" name="Yoʻlovchilar" val={N(r.p)} />
                  <TipRow sw="var(--c-sec)" name="Reyslar" val={N(r.r)} />
                </>
              ),
            }))}
            share={[
              { label: YON.MVL, value: byY.MVL?.p || 0, color: "var(--c-pri)" },
              { label: YON.VVL, value: byY.VVL?.p || 0, color: "var(--c-sec)" },
            ]}
            curLabel="Joriy davr"
            prevLabel={p === "ytd" ? "Oʻtgan yil" : "Oldingi 30 kun"}
            maxItems={20}
          />
        }
        table={<DataTable scroll rows={list} cols={cols} />} />
    </>
  );
}
