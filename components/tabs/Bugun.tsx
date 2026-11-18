/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { AP_FULL, AP_LIST } from "@/lib/static";
import { N, N1, P, T, sum } from "@/lib/format";
import { Delta, PlaneIcon, StatusPill, todayStr, useDash, useLookups, useSelAp } from "@/lib/dash";
import { Bars, Card, DataTable, Donut, Lines, Rank, Row, type Col } from "../charts";
import UzMap from "../UzMap";
import Sutka from "./Sutka";

export default function Bugun() {
  const { D, S } = useDash();
  const { apLabel, akName, placeName } = useLookups();
  const selAp = useSelAp();

  const agg = (k: string, tt?: number) => {
    const rows = selAp(D.bugun || []).filter((r) => r.k === k && (tt == null || r.tt === tt));
    const o: Record<string, number> = {};
    ["rej", "bek", "baj", "k15", "kd", "pax", "yuk", "poc", "bag", "hz_baj", "hz_pax"].forEach((f) => { o[f] = sum(rows, f); });
    return o;
  };
  const Tb = agg("bugun"), U = agg("bugun", 1), Q = agg("bugun", 2);
  const tb: any[] = selAp(D.tablo || []);
  const cnt = (h: string) => tb.filter((r) => r.holat === h).length;
  const otp = U.baj ? 1 - U.k15 / U.baj : null;
  const R = 38, Cc = 2 * Math.PI * R, pct = otp == null ? null : Math.round(otp * 100);
  const lb: [string, number, string][] = [["Qoʻnishlar", Q.baj, "#2a9d8f"], ["Uchishlar", U.baj, "#8ad4c4"], ["Charterlar", tb.filter((r) => r.st === "C").length, "#ffc48a"], ["Bekorlar", Tb.bek, "#d9534f"]];
  const nx = tb.filter((r) => r.tt === 2 && (r.holat === "kutilmoqda" || r.holat === "kechikmoqda")).sort((a, b) => (a.est || a.sch).localeCompare(b.est || b.sch))[0];

  // soatlar
  const sl = selAp(D.soatlik || []);
  const hrs: string[] = [], arr: number[] = [], dep: number[] = [];
  for (let h = 0; h < 24; h++) {
    const bt = sl.filter((r) => r.k === "bugun" && r.s === h);
    hrs.push(String(h).padStart(2, "0"));
    arr.push(sum(bt.filter((r) => r.tt === 2), (r) => r.rej - r.bek));
    dep.push(sum(bt.filter((r) => r.tt === 1), (r) => r.rej - r.bek));
  }
  const hrTips = hrs.map((x) => x + ":00 – " + x + ":59");

  // kunlar
  const kl = selAp(D.kunlik || []), byD: Record<string, number> = {}, today = todayStr(D);
  kl.forEach((r) => { if (r.kun < today) byD[r.kun] = (byD[r.kun] || 0) + r.baj; });
  const days = Object.keys(byD).sort().slice(-14), dv = days.map((d) => byD[d]);

  // yoʻnalish / aviakompaniya
  const dests: Record<string, number> = {}, aks: Record<string, number> = {};
  tb.forEach((r) => { if (r.holat === "bekor") return; if (r.bosh) dests[r.bosh] = (dests[r.bosh] || 0) + 1; if (r.ak) aks[r.ak] = (aks[r.ak] || 0) + 1; });
  const top = (o: Record<string, number>) => Object.keys(o).map((k) => ({ code: k, value: o[k] })).sort((a, b) => b.value - a.value).slice(0, 8);
  const next = tb.filter((r) => r.holat === "kutilmoqda" || r.holat === "kechikmoqda").sort((a, b) => (a.est || a.sch).localeCompare(b.est || b.sch)).slice(0, 7);

  // aeroportlar kesimi
  const rows: any[] = AP_LIST.map((ap) => {
    const f = (k: string, tt?: number) => (D.bugun || []).filter((r: any) => r.ap === ap && r.k === k && (tt == null || r.tt === tt));
    const u = f("bugun", 1), q = f("bugun", 2), all = f("bugun"), kk = f("kecha");
    return { ap, ub: sum(u, "baj"), ur: sum(u, "rej"), qb: sum(q, "baj"), qr: sum(q, "rej"), bek: sum(all, "bek"), k15: sum(u, "k15"), pax: sum(all, "pax"), kpax: sum(kk, "hz_pax"), yuk: sum(all, "yuk") + sum(all, "poc") };
  });
  const tot: any = { ap: "Jami" };
  ["ub", "ur", "qb", "qr", "bek", "k15", "pax", "kpax", "yuk"].forEach((k) => { tot[k] = sum(rows, k); });
  const cols: Col[] = [
    { h: "Aeroport", f: (r) => (r.ap === "Jami" ? "Jami" : <><b>{r.ap}</b><small>{apLabel(r.ap)}</small></>) },
    { h: "Uchish (bajarildi / reja)", n: true, f: (r) => N(r.ub) + " / " + N(r.ur) },
    { h: "Qoʻnish (bajarildi / reja)", n: true, f: (r) => N(r.qb) + " / " + N(r.qr) },
    { h: "Bekor", n: true, f: (r) => N(r.bek) },
    { h: "Oʻz vaqtida", n: true, f: (r) => (r.ub ? P(1 - r.k15 / r.ub) : "—") },
    { h: "Yoʻlovchilar", n: true, f: (r) => N(r.pax) },
    { h: "Kechaga", n: true, f: (r) => (r.kpax ? <Delta cur={r.pax} prev={r.kpax} /> : "—") },
    { h: "Yuk+pochta, t", n: true, f: (r) => N1(T(r.yuk)) },
  ];

  return (
    <>
      <UzMap />
      <Sutka />
      <Row cls="vg__row--three">
        <Card title="Bugun oʻz vaqtida" hint="Uchishlar: rejadan 15 daqiqagacha">
          <div className="vg__load">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(15,118,110,0.14)" strokeWidth="9" />
              {pct != null ? <circle cx="50" cy="50" r={R} fill="none" stroke="#2a9d8f" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${((pct / 100) * Cc).toFixed(1)} ${Cc.toFixed(1)}`} transform="rotate(-90 50 50)" /> : null}
              <text x="50" y="52" textAnchor="middle" style={{ fontSize: 19, fontWeight: 700, fill: "#0f2a2b" }}>{pct == null ? "—" : pct + "%"}</text>
              <text x="50" y="65" textAnchor="middle" style={{ fontSize: 8 }}>oʻz vaqtida</text>
            </svg>
            <ul className="vg__load-bars">
              {lb.map((x) => (
                <li key={x[0]}>
                  <span>{x[0]}<b>{N(x[1])}</b></span>
                  <i><u style={{ width: (Tb.rej ? Math.max(x[1] ? 4 : 0, (x[1] / Tb.rej) * 100) : 0) + "%", background: x[2] }} /></i>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card title="Keyingi qoʻnish" hint={S.ap === "ALL" ? "Barcha aeroportlar boʻyicha" : AP_FULL[S.ap]}>
          {!nx ? (
            <div className="vg__none">Bugun boshqa qoʻnish yoʻq</div>
          ) : (
            <>
              <div className="vg__next-top"><b style={{ fontSize: 15 }}>{(nx.ak || "") + " " + (nx.nr || "")}</b><StatusPill h={nx.holat} /></div>
              <div className="vg__next-route"><strong>{nx.bosh}</strong><span className="vg__next-line"><PlaneIcon /></span><strong>{nx.ap}</strong></div>
              <div className="vg__next-sub"><span>{placeName(nx.bosh) + " → " + apLabel(nx.ap)}</span><span>{(nx.est || nx.sch) + " · kutilmoqda"}</span></div>
              <div className="vg__next-sub"><span>{akName(nx.ak)}</span><span>{nx.vs || ""}</span></div>
            </>
          )}
        </Card>
        <Card title="Reyslar holati" hint="Bugun rejadagi barcha reyslar">
          <Donut parts={[{ label: "Bajarildi", value: cnt("bajarildi"), color: "#0f766e" }, { label: "Reja boʻyicha", value: cnt("kutilmoqda"), color: "#8ad4c4" }, { label: "Kechikmoqda", value: cnt("kechikmoqda"), color: "#f08a3c" }, { label: "Bekor qilindi", value: cnt("bekor"), color: "#d9534f" }]} total={tb.length} caption="reys" />
        </Card>
      </Row>

      <Row cls="vg__row--charts">
        <Card title="Soatlar boʻyicha harakat" hint="Bugun har soatda (UTC) nechta qoʻnish va uchish (rejadagi, bekorlarsiz)"
          chart={<Bars labels={hrs} tips={hrTips} series={[{ name: "Qoʻnishlar", fill: "teal", values: arr }, { name: "Uchishlar", fill: "orange", values: dep }]} fmt={N} h={230} labelW={34} />}
          table={<DataTable scroll rows={hrs.map((_, i) => ({ h: hrTips[i], a: arr[i], d: dep[i] }))} cols={[{ h: "Soat", f: (r) => r.h }, { h: "Qoʻnish", n: true, f: (r) => N(r.a) }, { h: "Uchish", n: true, f: (r) => N(r.d) }]} />} />
        <Card title="Kunlar boʻyicha reyslar" hint="Oxirgi 14 kun: qoʻnish va uchish birga"
          chart={
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "-2px 0 6px" }}>
                <strong style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-.02em" }}>{N(sum(dv, (v) => v))}</strong>
                <span style={{ color: "#5f7a78", fontSize: 12.5 }}>{"reys 14 kunda · kecha " + N(dv[dv.length - 1])}</span>
              </div>
              <Lines labels={days.map((d) => d.slice(8, 10) + "." + d.slice(5, 7))} tips={days} series={[{ name: "Reyslar", fill: "teal", values: dv, area: true, dots: true }]} fmt={N} h={196} labelW={44} />
            </>
          }
          table={<DataTable scroll rows={days.slice().reverse().map((d) => ({ d, v: byD[d] }))} cols={[{ h: "Kun", f: (r) => r.d }, { h: "Reyslar", n: true, f: (r) => N(r.v) }]} />} />
      </Row>

      <Row cls="vg__row--three">
        <Card title="Yoʻnalishlar" hint="Bugungi reyslar soni" chart={<Rank tone="warm" items={top(dests).map((x) => ({ code: x.code, sub: placeName(x.code), value: x.value }))} />} />
        <Card title="Aviakompaniyalar" hint="Bugungi reyslar soni" chart={<Rank items={top(aks).map((x) => ({ code: x.code, sub: akName(x.code), value: x.value }))} />} />
        <Card title="Yaqin reyslar" hint="Hali bajarilmagan eng yaqin reyslar">
          {!next.length ? (
            <div className="vg__none">Bugun boshqa reys qolmadi</div>
          ) : (
            <ul className="vg__flights">
              {next.map((r, i) => (
                <li key={i}>
                  <div className="vg__flights-main">
                    <b>{(r.ak || "") + (r.nr || "")} <span className="vg__dir">{r.tt === 1 ? "↗ uchish" : "↘ qoʻnish"}</span></b>
                    <small>{apLabel(r.ap) + (r.tt === 1 ? " → " : " ← ") + placeName(r.bosh)}</small>
                  </div>
                  <StatusPill h={r.holat} />
                  <div className="vg__flights-time"><b>{r.est || r.sch}</b>{r.est && r.est !== r.sch ? <s>{r.sch}</s> : null}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Row>

      <Card title="Aeroportlar kesimida — bugun" hint="Kechaga nisbatan: kecha xuddi shu soatgacha boʻlgan yoʻlovchilar bilan">
        <DataTable rows={rows} cols={cols} foot={tot} sel={(r) => r.ap === S.ap} />
      </Card>
    </>
  );
}
