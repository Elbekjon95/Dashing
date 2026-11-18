/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { AP_LIST, OY, OY_T } from "@/lib/static";
import { N, N1, P, T, sum } from "@/lib/format";
import { Delta, todayStr, useDash, useLookups, useSelAp } from "@/lib/dash";
import { Bars, Card, DataTable, Lines, Row, Stats, Tabs } from "../charts";
import StatRange from "./StatRange";

export const monthLbl = (mo: string) => OY[+mo.slice(5, 7) - 1] + (mo.slice(5, 7) === "01" ? " " + mo.slice(2, 4) : "");
export const monthTip = (mo: string) => OY_T[+mo.slice(5, 7) - 1] + " " + mo.slice(0, 4);

export default function Stat() {
  const { D, S, set } = useDash();
  const { apLabel } = useLookups();
  const selAp = useSelAp();

  const metrVal = (r: any) => (S.metr === "baj" ? r.baj : S.metr === "pax" ? r.pax : T((r.yuk || 0) + (r.poc || 0)));
  const metrNom = S.metr === "baj" ? "Reyslar" : S.metr === "pax" ? "Yoʻlovchilar" : "Yuk va pochta, t";
  const metrFmt = (v: number) => (S.metr === "yuk" ? N1(v) : N(v));

  const av = selAp(D.aviakompaniyalar || []), om: any[] = selAp(D.oylik || []);
  const now = new Date(), cy = now.getFullYear(), cm = now.getMonth(), py = cy - 1;
  const mo = (y: number, m: number) => y + "-" + String(m + 1).padStart(2, "0");
  const full = (y: number) => { const out: string[] = []; for (let m = 0; m < cm; m++) out.push(mo(y, m)); return out; };
  const inM = (list: string[]) => om.filter((r) => list.indexOf(r.oy) >= 0);
  const fc = inM(full(cy)), fp = inM(full(py)), curY = om.filter((r) => r.oy.slice(0, 4) === String(cy));
  const otpOf = (rows: any[]) => { const r = rows.filter((x) => x.tt === 1), b = sum(r, "baj"); return b ? (1 - sum(r, "k15") / b) * 100 : null; };
  const fullTxt = cm > 0 ? "yanvar–" + OY_T[cm - 1].toLowerCase() + ", toʻliq oylar" : "";

  const byM = (y: number) => { const a: (number | null)[] = []; for (let m = 0; m < 12; m++) { const k = mo(y, m); a.push(sum(om.filter((r) => r.oy === k), metrVal) || null); } return a; };
  const vc = byM(cy), vp = byM(py);
  const gr = OY.map((_, i) => ({ i, c: vc[i], p: vp[i] })).filter((x) => x.i <= cm);

  const months = Array.from(new Set(om.map((r) => r.oy as string))).sort().slice(-24);
  const yv = (y: string) => months.map((m) => sum(om.filter((r) => r.oy === m && r.yon === y), metrVal));
  const sMVL = yv("MVL"), sCIS = yv("CIS"), sVVL = yv("VVL");

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
      <StatRange />
      <Stats list={[
        { l: "Reyslar", v: N(sum(av, "r_ytd")), r: <><Delta big cur={sum(av, "r_ytd")} prev={sum(av, "r_ytdo")} /> edi {N(sum(av, "r_ytdo"))}</>, s: "yil boshidan kechagacha · bekor: " + N(sum(av, "b_ytd")) },
        { l: "Yoʻlovchilar", v: N(sum(av, "p_ytd")), r: <><Delta big cur={sum(av, "p_ytd")} prev={sum(av, "p_ytdo")} /> edi {N(sum(av, "p_ytdo"))}</>, s: "qoʻnish " + N(sum(curY.filter((r) => r.tt === 2), "pax")) + " · uchish " + N(sum(curY.filter((r) => r.tt === 1), "pax")) },
        { l: "Yuk aylanmasi", v: N1(T(sum(av, "y_ytd"))), u: "t", r: cm > 0 ? <><Delta big cur={sum(fc, "yuk") + sum(fc, "poc")} prev={sum(fp, "yuk") + sum(fp, "poc")} /> {fullTxt}</> : null, s: "yuk " + N1(T(sum(curY, "yuk"))) + " t · pochta " + N1(T(sum(curY, "poc"))) + " t · bagaj " + N1(T(sum(curY, "bag"))) + " t" },
        { l: "Oʻz vaqtida uchish", v: P(sum(av, "u_ytd") ? 1 - sum(av, "k_ytd") / sum(av, "u_ytd") : null), r: cm > 0 ? <><Delta big pp cur={otpOf(fc)} prev={otpOf(fp)} /> {fullTxt}</> : null, s: N(sum(av, "k_ytd")) + " ta uchish 15 daqiqadan koʻp kechikkan" },
      ]} />

      <Row cls="vg__row--wide">
        <Card title={`Oylar boʻyicha: ${cy} va ${py}`} hint={`Har oy oʻtgan yilning shu oyi bilan yonma-yon. ${OY_T[cm]} hali tugamagan (xira ustun).`}
          tools={<Tabs options={[["baj", "Reyslar"], ["pax", "Yoʻlovchilar"], ["yuk", "Yuk va pochta"]]} val={S.metr} onPick={(v) => set({ metr: v })} />}
          chart={<Bars labels={OY} tips={OY_T} series={[{ name: String(py), fill: "grey", values: vp }, { name: String(cy), fill: "teal", values: vc, faint: OY.map((_, i) => i === cm) }]} fmt={metrFmt} h={380} note={(i) => (i === cm ? "Joriy oy — bugungacha" : "")} />} />
        <Card title="Oʻsish va pasayish oylar boʻyicha" hint={metrNom}>
          <DataTable rows={gr} cols={[
            { h: "Oy", f: (r) => OY[r.i] + (r.i === cm ? " *" : "") },
            { h: String(cy), n: true, f: (r) => (r.c == null ? "—" : metrFmt(r.c)) },
            { h: String(py), n: true, f: (r) => (r.p == null ? "—" : metrFmt(r.p)) },
            { h: "Oʻzgarish", n: true, f: (r) => (r.i === cm ? <span className="vg__dir">toʻliq emas</span> : <Delta cur={r.c || 0} prev={r.p || 0} />) },
          ]} />
          <div className="vg__note">* joriy oy bugungacha</div>
        </Card>
      </Row>

      <Row cls="vg__row--two">
        <Card title={metrNom + ": xalqaro, MDH va ichki"} hint="Oxirgi 24 oy · oxirgi ustun — joriy oy (toʻliq emas)"
          chart={<Bars stack labels={months.map(monthLbl)} tips={months.map(monthTip)} fmt={metrFmt} h={250} labelW={34} series={[{ name: "Xalqaro", fill: "teal", values: sMVL }, { name: "MDH", fill: "mint", values: sCIS }, { name: "Ichki", fill: "orange", values: sVVL }]} />}
          table={<DataTable scroll rows={months.map((_, i) => ({ i })).reverse()} cols={[{ h: "Oy", f: (r) => monthTip(months[r.i]) }, { h: "Xalqaro", n: true, f: (r) => metrFmt(sMVL[r.i]) }, { h: "MDH", n: true, f: (r) => metrFmt(sCIS[r.i]) }, { h: "Ichki", n: true, f: (r) => metrFmt(sVVL[r.i]) }]} />} />
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
    </>
  );
}
