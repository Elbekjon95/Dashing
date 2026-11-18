/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useMemo } from "react";
import { AP_LIST, ST, YON } from "@/lib/static";
import { N, P, sum } from "@/lib/format";
import { Delta, TipRow, davrNom, useDash, useLookups, useSelAp } from "@/lib/dash";
import { Card, DataTable, Rank, Row, Stats, type Col } from "../charts";
import WorldMap from "../WorldMap";

export default function Yon() {
  const { D, S } = useDash();
  const { placeName, country } = useLookups();
  const selAp = useSelAp();
  const p = S.davr, dn = davrNom(p);

  const g = useMemo(() => {
    const byB: Record<string, any> = {}, byY: Record<string, any> = {}, byC: Record<string, any> = {}, pairs: Record<string, any> = {};
    selAp(D.yonalishlar || []).forEach((r: any) => {
      const o = (byB[r.bosh] = byB[r.bosh] || { b: r.bosh, yon: r.yon, r: 0, p: 0, po: 0 });
      o.r += r["r_" + p]; o.p += r["p_" + p]; o.po += r.p_ytdo;
      const y = (byY[r.yon] = byY[r.yon] || { r: 0, p: 0 });
      y.r += r["r_" + p]; y.p += r["p_" + p];
      if (r["p_" + p] > 0) { const key = r.ap + ">" + r.bosh; (pairs[key] = pairs[key] || { from: r.ap, to: r.bosh, n: 0 }).n += r["p_" + p]; }
    });
    const list: any[] = Object.keys(byB).map((k) => byB[k]).filter((x) => x.r > 0).sort((a, b) => b.p - a.p || b.r - a.r);
    list.forEach((x) => { const c = country(x.b); const o = (byC[c] = byC[c] || { c, r: 0, p: 0 }); o.r += x.r; o.p += x.p; });
    return { list, byY, byC, prs: Object.keys(pairs).map((k) => pairs[k]) as { from: string; to: string; n: number }[] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [D, S.ap, p]);
  const { list, byY, byC, prs } = g;
  const totP = sum(list, "p");
  const cl: any[] = Object.keys(byC).map((k) => byC[k]).sort((a, b) => b.p - a.p);

  const tr = D.turlar || { st: [], vs: [] };
  const agg = (rows: any[]) => { const o: Record<string, number> = {}; selAp(rows).forEach((r) => { o[r.k] = (o[r.k] || 0) + r[p]; }); return Object.keys(o).map((k) => ({ k, v: o[k] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v); };
  const st = agg(tr.st), vs = agg(tr.vs), stT = sum(st, "v");

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
      <Stats list={[
        ...["MVL", "CIS", "VVL"].map((y) => { const o = byY[y] || { r: 0, p: 0 }; return { l: YON[y] + " reyslar", v: P(o.p / (totP || 1)), s: N(o.p) + " yoʻlovchi · " + N(o.r) + " reys · " + dn }; }),
        { l: "Yoʻnalishlar", v: N(list.length), s: N(Object.keys(byC).length) + " ta davlat · " + dn },
      ]} />
      <Card title="Yoʻnalishlar xaritasi" hint={"Doira kattaligi — yoʻlovchilar soni · " + dn}
        chart={<WorldMap homes={S.ap === "ALL" ? AP_LIST : [S.ap]} pairs={prs} hub={S.ap === "ALL" ? "TAS" : undefined} top={10} unit="yoʻlovchi" aspect={2.6} />} />
      <Row cls="vg__row--two">
        <Card title="Eng katta yoʻnalishlar" hint={"Yoʻlovchilar boʻyicha top-20 · " + dn}
          chart={<Rank items={list.slice(0, 20).map((x) => ({ code: x.b, sub: placeName(x.b) + " · " + country(x.b), value: x.p, x }))}
            tip={(i) => <><div className="h">{placeName(i.x.b)} ({i.x.b})</div><TipRow name="Davlat" val={country(i.x.b)} /><TipRow name="Yoʻlovchilar" val={N(i.x.p)} /><TipRow name="Reyslar" val={N(i.x.r)} /><TipRow name="Turi" val={YON[i.x.yon] || i.x.yon} /></>} />} />
        <Card title="Davlatlar" hint={"Yoʻlovchilar boʻyicha · " + dn}
          chart={<Rank tone="warm" items={cl.slice(0, 15).map((x) => ({ code: x.c, value: x.p, extra: P(x.p / (totP || 1)) }))} />}
          table={<DataTable scroll rows={cl} cols={[{ h: "Davlat", f: (r) => r.c }, { h: "Yoʻlovchilar", n: true, f: (r) => N(r.p) }, { h: "Reyslar", n: true, f: (r) => N(r.r) }]} />} />
      </Row>
      <Row cls="vg__row--two">
        <Card title="Reys turlari" hint={"IATA xizmat turi · bajarilgan harakatlar · " + dn}
          chart={<Rank tone="deep" items={st.slice(0, 10).map((x) => ({ code: x.k, sub: ST[x.k] || "Boshqa", value: x.v, extra: P(x.v / (stT || 1)) }))} />} />
        <Card title="Samolyot turlari" hint={"Eng koʻp uchragan 12 tasi · " + dn}
          chart={<Rank short items={vs.slice(0, 12).map((x) => ({ code: x.k, value: x.v }))} />}
          table={<DataTable scroll rows={vs} cols={[{ h: "Samolyot turi", f: (r) => r.k }, { h: "Harakatlar", n: true, f: (r) => N(r.v) }]} />} />
      </Row>
      <Card title="Barcha yoʻnalishlar" hint={dn}>
        <DataTable scroll rows={list} cols={cols} />
      </Card>
    </>
  );
}
