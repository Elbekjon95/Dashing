/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState } from "react";
import { AP_LIST, OY, OY_T } from "@/lib/static";
import { N, N1, T, sum } from "@/lib/format";
import { Delta, todayStr, useDash, useLookups, useSelAp } from "@/lib/dash";
import { Bars, Card, DataTable, Lines, Row, Tabs } from "../charts";
import StatRange from "./StatRange";

export const monthLbl = (mo: string) => OY[+mo.slice(5, 7) - 1] + (mo.slice(5, 7) === "01" ? " " + mo.slice(2, 4) : "");
export const monthTip = (mo: string) => OY_T[+mo.slice(5, 7) - 1] + " " + mo.slice(0, 4);

export default function Stat() {
  const { D, S } = useDash();
  const { apLabel } = useLookups();
  const selAp = useSelAp();
  const [span, setSpan] = useState<"60" | "24">("60");

  const metrVal = (r: any) => (S.metr === "baj" ? r.baj : S.metr === "pax" ? r.pax : T((r.yuk || 0) + (r.poc || 0)));
  const metrNom = S.metr === "baj" ? "Reyslar" : S.metr === "pax" ? "Yoʻlovchilar" : "Yuk va pochta, t";
  const metrFmt = (v: number) => (S.metr === "yuk" ? N1(v) : N(v));

  const om: any[] = selAp(D.oylik || []), cy = new Date().getFullYear();


  const months = Array.from(new Set(om.map((r) => r.oy as string))).sort().slice(span === "60" ? -60 : -24);
  const yv = (y: string) => months.map((m) => sum(om.filter((r) => r.oy === m && r.yon === y), metrVal));
  const sCIS = yv("CIS"), sMVL = yv("MVL").map((v, i) => v + sCIS[i]), sVVL = yv("VVL"); // MDH xalqaroga kiradi

  const sp = selAp(D.soat_profil || []);
  const hrs: string[] = [], up: number[] = [], dn: number[] = [];
  for (let h = 0; h < 24; h++) {
    hrs.push(String(h).padStart(2, "0"));
    up.push(sum(sp.filter((r) => r.s === h && r.tt === 1), "o"));
    dn.push(sum(sp.filter((r) => r.s === h && r.tt === 2), "o"));
  }

  const kl = selAp(D.kunlik || []), byD: Record<string, number> = {}, today = todayStr(D);
  kl.forEach((r) => { if (r.kun < today) byD[r.kun] = (byD[r.kun] || 0) + metrVal(r); });
  const days = Object.keys(byD).sort(), dv = days.map((d) => byD[d]);
  const avg = dv.map((_, i) => { if (i < 6) return null; let s = 0; for (let j = i - 6; j <= i; j++) s += dv[j]; return s / 7; });

  const last = months.slice(-6), avAll: any[] = D.aviakompaniyalar || [];
  const rows: any[] = AP_LIST.map((ap) => {
    const r: any = { ap }, o = (D.oylik || []).filter((x: any) => x.ap === ap);
    last.forEach((m) => { r[m] = sum(o.filter((x: any) => x.oy === m), metrVal); });
    r.ytd = sum(o.filter((x: any) => x.oy.slice(0, 4) === String(cy)), metrVal);
    const a = avAll.filter((x) => x.ap === ap);
    r.cur = S.metr === "baj" ? sum(a, "r_ytd") : S.metr === "pax" ? sum(a, "p_ytd") : null;
    r.prev = S.metr === "baj" ? sum(a, "r_ytdo") : S.metr === "pax" ? sum(a, "p_ytdo") : null;
    return r;
  });
  const tot: any = { ap: "Jami" };
  last.concat(["ytd", "cur", "prev"]).forEach((k) => { tot[k] = sum(rows, k); });

  return (
    <>
      <StatRange>
      <Row cls="vg__row--two">
        <Card title={metrNom + ": xalqaro va ichki"} hint={(span === "60" ? "Oxirgi 60 oy (5 yil)" : "Oxirgi 24 oy") + " · oxirgi ustun — joriy oy (toʻliq emas)"}
          tools={<Tabs options={[["60", "5 yil"], ["24", "24 oy"]]} val={span} onPick={(v) => setSpan(v)} />}
          chart={<Bars stack labels={months.map(monthLbl)} tips={months.map(monthTip)} fmt={metrFmt} h={250} labelW={34} series={[{ name: "Xalqaro", fill: "teal", values: sMVL }, { name: "Ichki", fill: "orange", values: sVVL }]} />}
          table={<DataTable scroll rows={months.map((_, i) => ({ i })).reverse()} cols={[{ h: "Oy", f: (r) => monthTip(months[r.i]) }, { h: "Xalqaro", n: true, f: (r) => metrFmt(sMVL[r.i]) }, { h: "Ichki", n: true, f: (r) => metrFmt(sVVL[r.i]) }]} />} />
        <Card title="Kun davomida yuklama" hint="Oxirgi 28 kun: har soatda oʻrtacha nechta harakat"
          chart={<Bars labels={hrs} tips={hrs.map((x) => x + ":00 – " + x + ":59")} series={[{ name: "Qoʻnishlar", fill: "teal", values: dn }, { name: "Uchishlar", fill: "orange", values: up }]} fmt={N1} fmtAxis={(v) => N1(v).replace(/,0$/, "")} h={250} labelW={34} />}
          table={<DataTable scroll rows={hrs.map((x, i) => ({ h: x, u: up[i], d: dn[i] }))} cols={[{ h: "Soat", f: (r) => r.h + ":00" }, { h: "Qoʻnish", n: true, f: (r) => N1(r.d) }, { h: "Uchish", n: true, f: (r) => N1(r.u) }]} />} />
      </Row>

      <Card title={metrNom + ": kunlar boʻyicha"} hint={`Oxirgi ${days.length} kun (bugun kirmaydi) · toʻq chiziq — 7 kunlik oʻrtacha`}
        chart={<Lines labels={days.map((d) => d.slice(8, 10) + "." + d.slice(5, 7))} tips={days} fmt={metrFmt} h={230} labelW={56} series={[{ name: "Kunlik", fill: "mint", values: dv, area: true, w: 1.6 }, { name: "7 kunlik oʻrtacha", fill: "teal", values: avg, w: 2.6 }]} />}
        table={<DataTable scroll rows={days.slice().reverse().map((d) => ({ d, v: byD[d] }))} cols={[{ h: "Kun", f: (r) => r.d }, { h: metrNom, n: true, f: (r) => metrFmt(r.v) }]} />} />

      <Card title={metrNom + ": aeroportlar kesimida"} hint="Oxirgi 6 oy va yil boshidan · oʻzgarish — yil boshidan kechagacha, oʻtgan yilning shu davriga">
        <DataTable rows={rows} foot={tot} sel={(r) => r.ap === S.ap} cols={[
          { h: "Aeroport", f: (r) => (r.ap === "Jami" ? "Jami" : <><b>{r.ap}</b><small>{apLabel(r.ap)}</small></>) },
          ...last.map((m) => ({ h: OY[+m.slice(5, 7) - 1] + " " + m.slice(2, 4), n: true, f: (r: any) => metrFmt(r[m]) })),
          { h: cy + " yil boshidan", n: true, f: (r) => metrFmt(r.ytd) },
          { h: "Oʻzgarish", n: true, f: (r) => (S.metr === "yuk" ? "—" : <Delta cur={r.cur} prev={r.prev} />) },
        ]} />
      </Card>
      </StatRange>
    </>
  );
}
