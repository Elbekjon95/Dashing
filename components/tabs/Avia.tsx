/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { N, N1, P, T, sum } from "@/lib/format";
import { Delta, TipRow, davrNom, useDash, useLookups, useSelAp } from "@/lib/dash";
import { Card, DataTable, Rank, Row, Stats, Tabs, type Col } from "../charts";

const TP_TITLE: Record<string, string> = { all: "Barcha aviakompaniyalar", rp: "Muntazam yoʻlovchi reyslari", rc: "Muntazam yuk reyslari", cp: "Charter yoʻlovchi reyslari", cc: "Charter yuk reyslari", bz: "Biznes aviatsiya reyslari", ot: "Boshqa reyslar" };
const TP_OPTS: [string, string][] = [["all", "Hammasi"], ["rp", "Muntazam · yoʻlovchi"], ["rc", "Muntazam · yuk"], ["cp", "Charter · yoʻlovchi"], ["cc", "Charter · yuk"], ["bz", "Biznes"], ["ot", "Boshqa"]];

export default function Avia() {
  const { D, S } = useDash();
  const { akName } = useLookups();
  const selAp = useSelAp();
  const p = S.davr, dn = davrNom(p);
  const [tp, setTp] = useState<string>("all"); // jadval: reys turi boʻyicha
  const rowsAll: any[] = selAp(D.aviakompaniyalar || []);
  // tp: rp muntazam yoʻlovchi, rc muntazam yuk, cp charter yoʻlovchi, cc charter yuk, bz biznes, ot boshqa; eski maʼlumotda (tp yoʻq) hammasi muntazam yoʻlovchi
  const build = (rows: any[]) => {
    const byA: Record<string, any> = {};
    rows.forEach((r: any) => {
      const o = (byA[r.ak] = byA[r.ak] || { ak: r.ak, r: 0, p: 0, u: 0, k: 0, b: 0, y: 0, ro: 0, po: 0 });
      o.r += r["r_" + p]; o.p += r["p_" + p]; o.u += r["u_" + p]; o.k += r["k_" + p]; o.b += r["b_" + p]; o.y += r["y_" + p]; o.ro += r.r_ytdo; o.po += r.p_ytdo;
    });
    return Object.keys(byA).map((k) => byA[k]).filter((x) => x.r > 0 || x.b > 0).sort((a, b) => b.p - a.p || b.r - a.r);
  };
  const listAll = build(rowsAll);
  const list = listAll; // yuqoridagi koʻrsatkichlar va top-15 — barcha reyslar boʻyicha
  const tl = build(rowsAll.filter((r: any) => tp === "all" || (r.tp || "rp") === tp)); // jadval — tanlangan tur boʻyicha
  const tTotP = sum(tl, "p");
  const totP = sum(list, "p"), totR = sum(list, "r"), top1 = list[0];

  const cols: Col[] = [
    { h: "#", n: true, f: (r) => tl.indexOf(r) + 1 },
    { h: "Aviakompaniya", f: (r) => <><b>{r.ak}</b><small>{akName(r.ak)}</small></> },
    { h: "Reyslar", n: true, f: (r) => N(r.r) },
    { h: "Yoʻlovchilar", n: true, f: (r) => N(r.p) },
    { h: "Ulush", n: true, f: (r) => P(r.p / (tTotP || 1)) },
    { h: "Reysga oʻrtacha", n: true, f: (r) => (r.r ? N(r.p / r.r) : "—") },
  ];
  if (p === "ytd") cols.push({ h: "Oʻtgan yilga", n: true, f: (r) => <Delta cur={r.p} prev={r.po} /> });
  cols.push({ h: "Oʻz vaqtida", n: true, f: (r) => (r.u ? P(1 - r.k / r.u) : "—") }, { h: "Bekor", n: true, f: (r) => N(r.b) }, { h: "Yuk+pochta, t", n: true, f: (r) => N1(T(r.y)) });

  return (
    <>
      <Stats list={[
        { l: "Faol aviakompaniyalar", v: N(list.filter((x) => x.r > 0).length), s: dn },
        { l: "Reyslar", v: N(totR), r: p === "ytd" ? <><Delta big cur={totR} prev={sum(list, "ro")} /> edi {N(sum(list, "ro"))}</> : null, s: dn + " · uchish va qoʻnish" },
        { l: "Yoʻlovchilar", v: N(totP), r: p === "ytd" ? <><Delta big cur={totP} prev={sum(list, "po")} /> edi {N(sum(list, "po"))}</> : null, s: dn },
        { l: "Yetakchi ulushi", v: top1 ? P(top1.p / (totP || 1)) : "—", s: top1 ? akName(top1.ak) + " · yoʻlovchilar boʻyicha" : "" },
      ]} />
      <Row cls="vg__row--two">
        <Card title="Yoʻlovchilar boʻyicha top-15" hint={dn}
          chart={<Rank items={list.slice(0, 15).map((x) => ({ code: x.ak, sub: akName(x.ak), value: x.p, extra: P(x.p / (totP || 1)), x }))}
            tip={(i) => <><div className="h">{akName(i.x.ak)} ({i.x.ak})</div><TipRow name="Yoʻlovchilar" val={N(i.x.p)} /><TipRow name="Reyslar" val={N(i.x.r)} /><TipRow name="Ulush" val={P(i.x.p / (totP || 1))} /></>} />} />
        <Card title="Reyslar boʻyicha top-15" hint={dn + " · uchish va qoʻnish"}
          chart={<Rank tone="warm" items={list.slice().sort((a, b) => b.r - a.r).slice(0, 15).map((x) => ({ code: x.ak, sub: akName(x.ak), value: x.r, extra: P(x.r / (totR || 1)) }))} />} />
      </Row>
      <Card title={TP_TITLE[tp] || "Barcha aviakompaniyalar"} hint={dn + " · aviakompaniyalar boʻyicha"}
        tools={<Tabs options={TP_OPTS} val={tp} onPick={(v) => setTp(v)} />}>
        <DataTable scroll rows={tl} cols={cols} />
      </Card>
    </>
  );
}
