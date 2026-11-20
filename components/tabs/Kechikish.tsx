/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { N, P, N1, sum } from "@/lib/format";
import { TipRow, dGroup, davrNom, useDash, useLookups, useSelAp } from "@/lib/dash";
import { Card, DataTable, Lines, Rank, Row, Stats, type RankItem } from "../charts";
import { monthLbl, monthTip } from "./Stat";

export default function Kechikish() {
  const { D, S } = useDash();
  const { akName, dDesc } = useLookups();
  const selAp = useSelAp();
  const p = S.davr, dn = davrNom(p);
  const av: any[] = selAp(D.aviakompaniyalar || []), kc: any[] = selAp(D.kechikish || []);
  const u = sum(av, "u_" + p), k = sum(av, "k_" + p), b = sum(av, "b_" + p), n = sum(kc, "n_" + p), mn = sum(kc, "m_" + p);
  const noCode = sum(kc.filter((r) => r.kod === "-"), "n_" + p);

  const om: any[] = selAp(D.oylik || []);
  const months = Array.from(new Set(om.map((r) => r.oy as string))).sort().slice(-24);
  const otp = (tt: number) => months.map((m) => { const rr = om.filter((r) => r.oy === m && r.tt === tt), bj = sum(rr, "baj"); return bj ? (1 - sum(rr, "k15") / bj) * 100 : null; });
  const ou = otp(1), oq = otp(2), pf = (v: number) => N1(v) + "%";

  const byK: Record<string, { n: number; m: number }> = {}, byG: typeof byK = {}, byX: typeof byK = {};
  kc.forEach((r) => {
    const c = r["n_" + p], mm = r["m_" + p];
    if (!c) return;
    (byK[r.kod] = byK[r.kod] || { n: 0, m: 0 }); byK[r.kod].n += c; byK[r.kod].m += mm;
    const g = dGroup(r.kod); (byG[g] = byG[g] || { n: 0, m: 0 }); byG[g].n += c; byG[g].m += mm;
    if (r.xiz === "-") return; // "Koʻrsatilmagan" xizmat ro'yxatga kiritilmaydi
    const xs = (D.lugat && D.lugat.ks && D.lugat.ks[r.xiz]) || r.xiz;
    if (!/[\p{L}\p{N}]/u.test(String(xs))) return; // "....." kabi mazmunsiz nomlar ham kiritilmaydi
    (byX[xs] = byX[xs] || { n: 0, m: 0 }); byX[xs].n += c; byX[xs].m += mm;
  });
  const items = (o: typeof byK, lab: (k: string) => string, sub?: (k: string) => string): RankItem[] =>
    Object.keys(o).map((key) => ({ code: lab(key), sub: sub ? sub(key) : "", value: o[key].n, m: o[key].m, extra: N(o[key].m / o[key].n) + " daq" })).sort((a, b) => b.value - a.value);
  const tipF = (it: RankItem) => (
    <>
      <div className="h">{it.code}{it.sub ? " — " + it.sub : ""}</div>
      <TipRow name="Kechikkan reyslar" val={N(it.value)} />
      <TipRow name="Jami kechikish" val={N(it.m) + " daq"} />
      <TipRow name="Oʻrtacha" val={N(it.m / it.value) + " daq"} />
    </>
  );
  const iK = items(byK, (x) => (x === "-" ? "Kodsiz" : x), (x) => dDesc(x));
  // guruhlar: izoh (qaysi kodlar kiradi) va umumiy kechikkanlar ichidagi ulush
  const G_NOTE: Record<string, string> = {
    "Aviakompaniya ichki": "Aviakompaniyaning ichki sabablari",
    "Yoʻlovchi va bagaj": "Roʻyxatdan oʻtkazish, yoʻlovchilar va bagaj",
    "Yuk va pochta": "Yuk va pochtani qabul qilish va yuklash",
    "Yerdagi xizmat": "Yerdagi xizmat: yoqilgʻi, tozalash, ovqat va boshqalar",
    "Texnik sabablar": "Samolyotning texnik holati",
    "Shikast / IT tizimlar": "Samolyot shikasti va IT tizimlari",
    "Ekipaj va parvoz operatsiyasi": "Ekipaj va parvoz operatsiyalari",
    "Ob-havo": "Ob-havo sharoiti",
    "Havo harakati va aeroport": "Havo harakati boshqaruvi va aeroport cheklovlari",
    "Aylanma (oldingi reys)": "Samolyot oldingi reysdan kech kelgani uchun — zanjirli kechikish",
    "Boshqa": "Boshqa sabablar",
    "Kodsiz / nomaʼlum": "Sabab kodi kiritilmagan",
  };
  const G_CODE: Record<string, string> = { "Aviakompaniya ichki": "01–09", "Yoʻlovchi va bagaj": "10–19", "Yuk va pochta": "20–29", "Yerdagi xizmat": "30–39", "Texnik sabablar": "40–49", "Shikast / IT tizimlar": "50–59", "Ekipaj va parvoz operatsiyasi": "60–69", "Ob-havo": "70–79", "Havo harakati va aeroport": "80–89", "Aylanma (oldingi reys)": "90–96", "Boshqa": "97–99" };
  const gLbl = (g: string) => (G_CODE[g] ? "(" + G_CODE[g] + ") " : "") + g; // kod nomdan oldin
  const gTot = Object.keys(byG).reduce((t, k) => t + byG[k].n, 0);
  const iG: any[] = Object.keys(byG).map((g) => ({ code: gLbl(g), g, sub: "", value: byG[g].n, m: byG[g].m, extra: P(byG[g].n / (gTot || 1)) + " · " + N(byG[g].m / byG[g].n) + " daq" })).sort((x, y) => y.value - x.value);
  const tipG = (it: RankItem) => (
    <>
      <div className="h">{it.code}</div>
      <div style={{ maxWidth: 240, fontSize: 11.5, opacity: 0.85, marginBottom: 4 }}>{G_NOTE[(it as any).g] || ""}</div>
      <TipRow name="Kechikkan uchishlar" val={N(it.value)} />
      <TipRow name="Ulushi" val={P(it.value / (gTot || 1))} />
      <TipRow name="Oʻrtacha kechikish" val={N(it.m / it.value) + " daq"} />
    </>
  );
  const iX = items(byX, (x) => x);

  const byA: Record<string, any> = {};
  av.forEach((r) => { const o = (byA[r.ak] = byA[r.ak] || { ak: r.ak, u: 0, k: 0, b: 0 }); o.u += r["u_" + p]; o.k += r["k_" + p]; o.b += r["b_" + p]; });
  const al = Object.keys(byA).map((x) => byA[x]).filter((x) => x.u >= 10).sort((a, b) => b.u - a.u).slice(0, 25);

  return (
    <>
      <Stats list={[
        { l: "Oʻz vaqtida uchish", v: P(u ? 1 - k / u : null), s: N(u) + " ta uchishdan · rejadan 15 daqiqagacha · " + dn },
        { l: "Kechikkan uchishlar", v: N(k), r: <><span className="vg__delta vg__delta--down">{P(u ? k / u : null)}</span> barcha uchishlarning</>, s: "15 daqiqadan koʻp kechikkanlar" },
        { l: "Oʻrtacha kechikish", v: n ? N(mn / n) : "—", u: "daq", s: "kechikkan reyslar boʻyicha (24 soatgacha)" },
        { l: "Bekor qilingan", v: N(b), s: "uchish va qoʻnish · sababi koʻrsatilmagan kechikishlar: " + N(noCode) },
      ]} />

      <Card title="Oʻz vaqtida bajarilgan reyslar ulushi" hint="Oxirgi 24 oy · rejadan 15 daqiqagacha farq «oʻz vaqtida» hisoblanadi"
        chart={<Lines labels={months.map(monthLbl)} tips={months.map(monthTip)} fmt={pf} fmtAxis={(v) => N(v) + "%"} zero={false} max={100} h={240} labelW={40} series={[{ name: "Uchish", fill: "teal", values: ou, area: true }, { name: "Qoʻnish", fill: "orange", values: oq }]} />}
        table={<DataTable scroll rows={months.map((_, i) => ({ i })).reverse()} cols={[{ h: "Oy", f: (r) => monthTip(months[r.i]) }, { h: "Uchish", n: true, f: (r) => (ou[r.i] == null ? "—" : pf(ou[r.i] as number)) }, { h: "Qoʻnish", n: true, f: (r) => (oq[r.i] == null ? "—" : pf(oq[r.i] as number)) }]} />} />

      <Row cls="vg__row--three">
        <Card title="Sabablar (IATA kodi)" hint={dn + " · eng koʻp 12 tasi · oʻngda — oʻrtacha kechikish"}
          chart={<Rank items={iK.slice(0, 12)} tip={tipF} tone="warm" />}
          table={<DataTable scroll rows={iK} cols={[{ h: "Kod", f: (r) => r.code }, { h: "Sabab", f: (r) => r.sub }, { h: "Reyslar", n: true, f: (r) => N(r.value) }, { h: "Oʻrtacha", n: true, f: (r) => r.extra }]} />} />
        <Card title="Kechikish sabablari (guruhlar)" hint={"Rejadan 15 daqiqadan ko'p kechikkan uchishlar · IATA sabab kodlari guruhlarga yig'ilgan · " + dn}
          chart={<Rank items={iG} tip={tipG} tone="red" />}
          table={<DataTable rows={iG} cols={[
            { h: "Sabab guruhi", f: (r) => <>{r.code}<small>{G_NOTE[r.g] || ""}</small></> },
            { h: "Kechikkan uchishlar", n: true, f: (r) => N(r.value) },
            { h: "Ulush", n: true, f: (r) => P(r.value / (gTot || 1)) },
            { h: "Oʻrtacha kechikish", n: true, f: (r) => N(r.m / r.value) + " daq" },
          ]} />} />
        <Card title="Masʼul xizmat" hint={"Bazadagi kechikish xizmati boʻyicha · " + dn}
          chart={<Rank items={iX.slice(0, 12)} tip={tipF} tone="deep" />}
          table={<DataTable scroll rows={iX} cols={[{ h: "Xizmat", f: (r) => r.code }, { h: "Reyslar", n: true, f: (r) => N(r.value) }, { h: "Oʻrtacha", n: true, f: (r) => r.extra }]} />} />
      </Row>

      <Card title="Aviakompaniyalar: oʻz vaqtida uchish" hint={"Eng koʻp uchgan 25 tasi (kamida 10 ta uchish) · " + dn}>
        <DataTable scroll rows={al} cols={[
          { h: "Aviakompaniya", f: (r) => <><b>{r.ak}</b><small>{akName(r.ak)}</small></> },
          { h: "Uchishlar", n: true, f: (r) => N(r.u) },
          { h: "Kechikkan", n: true, f: (r) => N(r.k) },
          { h: "Oʻz vaqtida", n: true, f: (r) => P(1 - r.k / r.u) },
          { h: "Bekor", n: true, f: (r) => N(r.b) },
        ]} />
      </Card>
    </>
  );
}
