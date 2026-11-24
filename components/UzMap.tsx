/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AP_FULL, AP_LIST, COORDS, REG_NAME, REG_SHORT } from "@/lib/static";
import { N, nf1v, sum, T, iso } from "@/lib/format";
import { ChevL, ChevR, Delta, PauseIcon, PlayIcon, PlaneIcon, todayStr, useDash, useLookups } from "@/lib/dash";
import { AP_REGION, METRICS, NAMED, SHOW_METRIC, SLIDE_MS, UZ_PATHS, addM, dayLabel, dirOf, mDom, mVal, metricsAll, metricsOf, monthName, periods, shade, topRows, tourCodes, unitOf, uzProject, xkIndex, ymStr, zeroM, type YM } from "@/lib/uzcalc";

const showV = (v: number, k: string) => ((k === "cargo" || k === "fuel") && v < 100 ? nf1v.format(v) : N(v));

function hashParam(k: string) {
  if (typeof location === "undefined") return null;
  const m = location.hash.match(new RegExp(k + "=(\\w+)"));
  return m ? m[1] : null;
}

function Tile({ label, value, unit, dl, sub }: { label: string; value: ReactNode; unit?: string; dl?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="uzm__tile">
      <span className="uzm__tile-label">{label}</span>
      <strong>
        {value}
        {unit ? <small> {unit}</small> : null}
      </strong>
      <span className="uzm__tile-foot">
        {dl}
        {sub ? <em>{sub}</em> : null}
      </span>
    </div>
  );
}

// kichik chiziqli ikonkalar (lucide uslubida)
const Ic = ({ children, rot }: { children: ReactNode; rot?: number }) => (
  <svg className="uzm__ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={rot ? { transform: `rotate(${rot}deg)` } : undefined} aria-hidden="true">{children}</svg>
);
const PLANE = <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />;
export const ICONS: Record<string, ReactNode> = {
  dep: <Ic>{PLANE}</Ic>,
  arr: <Ic rot={90}>{PLANE}</Ic>,
  users: <Ic><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Ic>,
  done: <Ic><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Ic>,
  cargo: <Ic><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></Ic>,
  bag: <Ic><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></Ic>,
  fuel: <Ic><path d="M3 22h12" /><path d="M4 9h10" /><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" /><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5" /></Ic>,
  grid: <Ic><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></Ic>,
  calendar: <Ic><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Ic>,
  pie: <Ic><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></Ic>,
  route: <Ic><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></Ic>,
  home: <Ic><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></Ic>,
  globe: <Ic><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Ic>,
  trophy: <Ic><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></Ic>,
  activity: <Ic><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></Ic>,
  alert: <Ic><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></Ic>,
  clock: <Ic><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Ic>,
};

// ixcham karta: ikonka + nom, qiymat va oʻzgarish bir qatorda, izoh pastda
function TileC({ icon, label, value, unit, dl, sub }: { icon: string; label: string; value: ReactNode; unit?: string; dl?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="uzm__tile uzm__tile--c">
      <span className="uzm__tile-label">{ICONS[icon]}{label}</span>
      <div className="uzm__tile-row">
        <strong>{value}{unit ? <small> {unit}</small> : null}</strong>
        {dl}
      </div>
      {sub ? <em className="uzm__tile-sub">{sub}</em> : null}
    </div>
  );
}

// Bugungi rejim: aviakompaniya / yoʻnalish roʻyxati bugungi reyslar jadvalidan (har 5 daqiqada yangilanadi).
// Koʻrsatkich yoʻlovchi boʻlsa — yoʻlovchilar, boshqa holatda (yuk, yoqilgʻi — kunlik maʼlumot yoʻq) — reyslar soni.
function TodayList({ field, ap, k, nameFn }: { field: "ak" | "bosh"; ap: string; k: string; nameFn: (c: string) => string }) {
  const { D } = useDash();
  const usePax = k === "pax";
  const agg: Record<string, { n: number; p: number; dep: number; arr: number }> = {};
  ((D && D.tablo) || []).forEach((r: any) => {
    if (r.holat === "bekor" || !r[field] || (ap !== "ALL" && r.ap !== ap)) return;
    const o = (agg[r[field]] = agg[r[field]] || { n: 0, p: 0, dep: 0, arr: 0 });
    o.n += 1; o.p += r.pax || 0; if (r.tt === 1) o.dep += 1; else o.arr += 1;
  });
  const rows = Object.keys(agg).map((c) => ({ c, ...agg[c] })).sort((a, b) => (usePax ? b.p - a.p : b.n - a.n) || b.n - a.n).slice(0, 6);
  if (!rows.length) return <div className="vg__none">Maʼlumot yoʻq</div>;
  const top = Math.max(1, ...rows.map((r) => (usePax ? r.p : r.n)));
  return (
    <ul className="vg__rank uzm__rank uzm__rank--today">
      {rows.map((r) => {
        const v = usePax ? r.p : r.n;
        return (
          <li key={r.c} title={nameFn(r.c)}>
            <span className="vg__rank-code">{r.c}</span>
            <span className="uzm__rank-name">{nameFn(r.c)}</span>
            <span className="vg__rank-bar"><i style={{ width: Math.max(3, (v / top) * 100) + "%" }} /></span>
            <b>{N(v)}</b>
            <span className="uzm__rank-sub">{usePax ? N(r.n) + " reys" : N(r.p) + " yoʻlovchi"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function TopList({ t, oy, cmpOy, ap, k, nameFn }: { t: string; oy: string; cmpOy: string; ap: string; k: string; nameFn: (c: string) => string }) {
  const { D } = useDash();
  const rowsOf = (o: string) => {
    if (ap !== "ALL") return topRows(D, t, o, ap);
    const acc: Record<string, any> = {};
    AP_LIST.forEach((a) => topRows(D, t, o, a).forEach((r: any) => {
      const m = (acc[r.k] = acc[r.k] || { k: r.k, m: { flights: 0, pax: 0, cargo_kg: 0, mail_kg: 0, fuel_kg: 0 } });
      for (const f in r.m) m.m[f] += r.m[f] || 0;
    }));
    return Object.values(acc);
  };
  const cmp: Record<string, any> = {};
  rowsOf(cmpOy).forEach((r: any) => { cmp[r.k] = r.m; });
  const cur = rowsOf(oy)
    .sort((a: any, b: any) => mVal(b.m, k) - mVal(a.m, k))
    .filter((r: any) => mVal(r.m, k) > 0)
    .slice(0, 6);
  if (!cur.length) return <div className="vg__none">Maʼlumot yoʻq</div>;
  const top = Math.max(...cur.map((r: any) => mVal(r.m, k)));
  return (
    <ul className="vg__rank uzm__rank">
      {cur.map((r: any) => {
        const v = mVal(r.m, k), pv = cmp[r.k] ? mVal(cmp[r.k], k) : 0;
        return (
          <li key={r.k} title={nameFn(r.k)}>
            <span className="vg__rank-code">{r.k}</span>
            <span className="uzm__rank-name">{nameFn(r.k)}</span>
            <span className="vg__rank-bar"><i style={{ width: Math.max(3, (v / top) * 100) + "%" }} /></span>
            <b>{showV(v, k)}</b>
            <Delta cur={v} prev={pv} />
          </li>
        );
      })}
    </ul>
  );
}

type Ap = { code: string; cur: ReturnType<typeof zeroM>; cmp: ReturnType<typeof zeroM> };

function Detail(p: { a: Ap; pr: ReturnType<typeof periods>; k: string; unit: string; ym: YM; slide: number; setSlide: (n: number, stop?: boolean) => void; playing: boolean; hold: boolean; dotKey: number; onEnter: () => void; onLeave: () => void }) {
  const { D } = useDash();
  const { akName, placeName } = useLookups();
  const { a, pr, k, unit, slide } = p;
  const c = a.cur, pv = a.cmp, oy = pr.mfrom.slice(0, 7), cmpOy = pr.running ? ymStr(pr.prev) + "~" : ymStr(pr.prev);
  const otpC = c.ms ? Math.round((c.ot / c.ms) * 1000) / 10 : null, otpP = pv.ms ? Math.round((pv.ot / pv.ms) * 1000) / 10 : null;
  const cov = c.flights ? Math.round((c.with_load / c.flights) * 100) : null;
  const titles = ["Koʻrsatkichlar", "Kunlar boʻyicha", "Tarkibi", "Yoʻnalishlar"], tabIc = ["grid", "calendar", "pie", "route"];
  let body: ReactNode;
  if (slide === 0 && pr.daily && D.bugun && D.bugun.length) {
    const du = dirOf(D, a.code, "bugun", 1), dq = dirOf(D, a.code, "bugun", 2), ku = dirOf(D, a.code, "kecha", 1), kq = dirOf(D, a.code, "kecha", 2);
    body = (
      <>
        <div className="uzm__tiles uzm__tiles--dir">
          <TileC icon="dep" label="Reyslar · uchish" value={N(du.rej)} dl={<Delta cur={du.rej} prev={ku.rej} />} sub={"kecha jami " + N(ku.rej) + " · bekor " + N(du.bek)} />
          <TileC icon="arr" label="Reyslar · qoʻnish" value={N(dq.rej)} dl={<Delta cur={dq.rej} prev={kq.rej} />} sub={"kecha jami " + N(kq.rej) + " · bekor " + N(dq.bek)} />
          <TileC icon="users" label="Yoʻlovchilar · uchish" value={N(du.pax)} dl={<Delta cur={du.pax} prev={ku.hz_pax} />} sub={"kecha " + N(ku.hz_pax)} />
          <TileC icon="users" label="Yoʻlovchilar · qoʻnish" value={N(dq.pax)} dl={<Delta cur={dq.pax} prev={kq.hz_pax} />} sub={"kecha " + N(kq.hz_pax)} />
          <TileC icon="done" label="Bajarilgan · uchish" value={N(du.baj)} dl={<Delta cur={du.baj} prev={ku.hz_baj} />} sub={"kecha " + N(ku.hz_baj)} />
          <TileC icon="done" label="Bajarilgan · qoʻnish" value={N(dq.baj)} dl={<Delta cur={dq.baj} prev={kq.hz_baj} />} sub={"kecha " + N(kq.hz_baj)} />
        </div>
        <div className="uzm__tiles uzm__tiles--mini">
          <TileC icon="cargo" label="Yuk aylanmasi" value={showV(T(c.cargo_kg + c.mail_kg), "cargo")} unit="t" dl={<Delta cur={c.cargo_kg + c.mail_kg} prev={pv.cargo_kg + pv.mail_kg} />} />
          <TileC icon="bag" label="Bagaj" value={showV(T(c.baggage_kg), "cargo")} unit="t" dl={<Delta cur={c.baggage_kg} prev={pv.baggage_kg} />} />
          <TileC icon="fuel" label="Yoqilgʻi" value={showV(T(c.fuel_kg), "fuel")} unit="t" dl={<Delta cur={c.fuel_kg} prev={pv.fuel_kg} />} />
          <TileC icon="clock" label="Oʻz vaqtida" value={otpC == null ? "—" : nf1v.format(otpC)} unit={otpC == null ? "" : "%"} dl={otpC != null && otpP != null ? <Delta cur={otpC} prev={otpP} pp /> : null} />
        </div>
      </>
    );
  } else if (slide === 0) {
    body = (
      <>
      <div className="uzm__tiles">
        <Tile label="Reyslar" value={N(c.flights)} dl={<Delta cur={c.flights} prev={pv.flights} />} sub={"bekor " + N(c.cancelled)} />
        <Tile label="Yoʻlovchilar" value={N(c.pax)} dl={<Delta cur={c.pax} prev={pv.pax} />} sub={"qoʻnish " + N(c.pax_arr) + " · uchish " + N(c.pax_dep)} />
        <Tile label="Yuk aylanmasi" value={showV(T(c.cargo_kg + c.mail_kg), "cargo")} unit="t" dl={<Delta cur={c.cargo_kg + c.mail_kg} prev={pv.cargo_kg + pv.mail_kg} />} sub={"yuk " + showV(T(c.cargo_kg), "cargo") + " t · pochta " + showV(T(c.mail_kg), "cargo") + " t"} />
        <Tile label="Bagaj" value={showV(T(c.baggage_kg), "cargo")} unit="t" dl={<Delta cur={c.baggage_kg} prev={pv.baggage_kg} />} />
        <Tile label="Yoqilgʻi" value={showV(T(c.fuel_kg), "fuel")} unit="t" dl={<Delta cur={c.fuel_kg} prev={pv.fuel_kg} />} sub="uchishdagi bortdagi yoqilgʻi" />
        <Tile label="Oʻz vaqtida" value={otpC == null ? "—" : nf1v.format(otpC)} unit={otpC == null ? "" : "%"} dl={otpC != null && otpP != null ? <Delta cur={otpC} prev={otpP} pp /> : null} sub={"15 daq ichida · kechikish " + N(c.dl) + ", " + N(c.dm) + " daq"} />
      </div>
      <p className="uzm__note" style={{ marginTop: 10 }}>
        {pr.daily
          ? "↗ ↘ — kecha (" + dayLabel(pr.cfrom) + ") " + (pr.gacha ? "soat " + pr.gacha + " UTC gacha" : "butun kun") + " boʻlgan miqdor bilan solishtirish."
          : "↗ ↘ — " + monthName(pr.prev) + (pr.running ? "ning xuddi shu kunlari (1–" + pr.cto.slice(8) + "-sana)" : "") + " bilan solishtirish."}
      </p>
      </>
    );
  } else if (slide === 1) {
    const x = xkIndex(D), ci = x.ci, byDay: Record<string, number> = {};
    (a.code === "ALL" ? AP_LIST.flatMap((c) => x.by[c] || []) : x.by[a.code] || []).forEach((r) => {
      const d = r[ci.kun];
      if (d >= pr.mfrom && d <= pr.mto) {
        const m = zeroM();
        m.flights = r[ci.f]; m.pax = r[ci.pa] + r[ci.pd]; m.cargo_kg = r[ci.c]; m.mail_kg = r[ci.m]; m.fuel_kg = r[ci.u];
        byDay[d] = (byDay[d] || 0) + mVal(m, k);
      }
    });
    const days: string[] = [];
    const dd = new Date(+pr.mfrom.slice(0, 4), +pr.mfrom.slice(5, 7) - 1, 1);
    while (iso(dd) <= pr.mto && days.length < 31) { days.push(iso(dd)); dd.setDate(dd.getDate() + 1); }
    const vals = days.map((d) => byDay[d] || 0), mx = Math.max(1, ...vals), W = 640, H = 300, slot = W / Math.max(1, days.length);
    const bi = vals.indexOf(Math.max(...vals)), avg = vals.reduce((s, v) => s + v, 0) / Math.max(1, days.length);
    body = (
      <>
        <div className="vg__float-title uzm__ttl">{ICONS.calendar}Kunlar boʻyicha ({unit})</div>
        <svg viewBox={`0 0 ${W} ${H + 16}`} style={{ width: "100%", height: 0, flex: "1 1 0", minHeight: 0 }}>
          <line x1="0" x2={W} y1={H} y2={H} className="g-grid" />
          {days.map((d, i) => {
            const h = (vals[i] / mx) * (H - 6);
            return (
              <g key={d} className="uzm__col">
                <rect x={i * slot} y={0} width={slot} height={H} className="uzm__hit" />
                {vals[i] > 0 ? <rect x={i * slot + 1.5} y={H - h} width={Math.max(2, slot - 3)} height={h} rx="2.5" className="uzm__bar" /> : null}
                {(() => {
                  // tez va katta tooltip: sichqoncha ustuncha ustiga kelishi bilan darhol chiqadi
                  const tw = 118, th = 46, cx = i * slot + slot / 2, tx = Math.min(Math.max(0, cx - tw / 2), W - tw), ty = Math.max(2, H - h - th - 8);
                  return (
                    <g className="uzm__tip" pointerEvents="none">
                      <rect x={tx} y={ty} width={tw} height={th} rx="9" />
                      <text x={tx + tw / 2} y={ty + 17} textAnchor="middle" className="uzm__tip-d">{d.slice(8) + "." + d.slice(5, 7) + "." + d.slice(0, 4)}</text>
                      <text x={tx + tw / 2} y={ty + 36} textAnchor="middle" className="uzm__tip-v">{showV(vals[i], k) + " " + unit}</text>
                    </g>
                  );
                })()}
                {i === 0 || i === days.length - 1 || (i + 1) % 5 === 0 ? <text x={i * slot + slot / 2} y={H + 13} textAnchor="middle">{d.slice(8)}</text> : null}
              </g>
            );
          })}
        </svg>
        <div className="uzm__facts">
          <div><span className="uzm__ttl">{ICONS.trophy}Eng band kun</span><b>{vals[bi] > 0 ? days[bi].slice(8) + "." + days[bi].slice(5, 7) + " · " + showV(vals[bi], k) + " " + unit : "—"}</b></div>
          <div><span className="uzm__ttl">{ICONS.activity}Kuniga oʻrtacha</span><b>{nf1v.format(avg) + " " + unit}</b></div>
        </div>
      </>
    );
  } else if (slide === 2) {
    const dc = mDom(c, k), dp = mDom(pv, k), ic = mVal(c, k) - dc, ip = mVal(pv, k) - dp, sm = Math.max(1e-9, dc, ic);
    body = (
      <>
        <div className="vg__float-title uzm__ttl">{ICONS.pie}Ichki va xalqaro ({unit})</div>
        <ul className="uzm__segs">
          <li><span><span className="uzm__ttl">{ICONS.home}Ichki</span><b>{showV(dc, k)}</b></span><i><u className="uzm__seg--d" style={{ width: (dc / sm) * 100 + "%" }} /></i><Delta cur={dc} prev={dp} /></li>
          <li><span><span className="uzm__ttl">{ICONS.globe}Xalqaro (MDH bilan)</span><b>{showV(ic, k)}</b></span><i><u className="uzm__seg--i" style={{ width: (ic / sm) * 100 + "%" }} /></i><Delta cur={ic} prev={ip} /></li>
        </ul>
        <div className="vg__float-title uzm__ttl" style={{ marginTop: 6 }}>{ICONS.dep}Aviakompaniyalar ({pr.daily ? (k === "pax" ? "yoʻlovchi" : "reys") : unit}){pr.daily ? " · bugun" : ""}</div>
        {pr.daily ? <TodayList field="ak" ap={a.code} k={k} nameFn={akName} /> : <TopList t="ak" oy={oy} cmpOy={cmpOy} ap={a.code} k={k} nameFn={akName} />}
      </>
    );
  } else {
    body = (
      <>
        <div className="vg__float-title uzm__ttl">{ICONS.route}Yoʻnalishlar ({pr.daily ? (k === "pax" ? "yoʻlovchi" : "reys") : unit}){pr.daily ? " · bugun" : ""}</div>
        {pr.daily ? <TodayList field="bosh" ap={a.code} k={k} nameFn={placeName} /> : <TopList t="r" oy={oy} cmpOy={cmpOy} ap={a.code} k={k} nameFn={placeName} />}
      </>
    );
  }
  return (
    <div className="vg__float uzm__detail" onMouseEnter={p.onEnter} onMouseLeave={p.onLeave}>
      <div className="uzm__detail-head">
        <div className="uzm__detail-name">
          <span className="uzm__badge"><PlaneIcon />{a.code === "ALL" ? "UZ" : a.code}</span>
          <div>
            <h3>{a.code === "ALL" ? "Umumiy — barcha aeroportlar" : AP_FULL[a.code]}</h3>
            <p>{(a.code === "ALL" ? "Oʻzbekiston" : REG_NAME[AP_REGION[a.code] || ""] || "") + " · " + (pr.daily ? "Bugun, " + dayLabel(pr.to) + " · kecha " + dayLabel(pr.cfrom) + (pr.gacha ? ", " + pr.gacha + " UTC gacha" : "") + " bilan solishtirildi" : monthName(p.ym) + (pr.running ? " · " + pr.to.slice(8) + "." + pr.to.slice(5, 7) + " gacha" : ""))}</p>
          </div>
        </div>
        {pr.daily ? null : <p className="uzm__compare">Solishtirish: {monthName(pr.prev)}.{pr.running ? " Oyning xuddi shu kunlari." : ""}</p>}
      </div>
      <div className="uzm__slider">
        <div className="uzm__slider-nav">
          <div className="vg__tabs">
            {titles.map((t, i) => <button key={i} className={(i === slide ? "on" : "") + " uzm__tabbtn"} onClick={() => p.setSlide(i, true)}>{ICONS[tabIc[i]]}{t}</button>)}
          </div>
          <div className="uzm__arrows">
            <button aria-label="Oldingi" onClick={() => p.setSlide((slide + 3) % 4, true)}><ChevL /></button>
            <button aria-label="Keyingi" onClick={() => p.setSlide((slide + 1) % 4, true)}><ChevR /></button>
          </div>
        </div>
        <section className="uzm__slide" key={slide}>{body}</section>
        <div className="uzm__dots">
          {titles.map((t, i) => (
            <button key={i} className={i === slide ? "on" : ""} onClick={() => p.setSlide(i, true)}>
              {i === slide && p.playing ? <i key={p.dotKey} style={{ animationDuration: SLIDE_MS + "ms", animationPlayState: p.hold ? "paused" : "running" }} /> : null}
            </button>
          ))}
        </div>
      </div>
      {pr.daily && slide === 0 && cov != null ? null : <p className="uzm__note">{cov == null ? (pr.daily ? "Bugun aeroportda reyslar yoʻq." : "Bu oyda aeroportda reyslar yoʻq.") : "Yuklash kartasi reyslarning " + cov + "% da toʻldirilgan: yoʻlovchi, yuk va yoqilgʻi shu boʻyicha hisoblanadi."}</p>}
    </div>
  );
}

export default function UzMap() {
  const { D } = useDash();
  const today = todayStr(D);
  const cur: YM = { y: +today.slice(0, 4), m: +today.slice(5, 7) };
  const x = xkIndex(D);
  const first: YM = { y: +x.first.slice(0, 4), m: +x.first.slice(5, 7) };

  const [daily, setDaily] = useState(true); // birinchi koʻrinish — bugungi kun (Toshkent vaqti, 00:00 dan)
  const [ym, setYm] = useState<YM>(cur);
  const [metric, setMetric] = useState(() => hashParam("metric") || "flights");
  const [code, setCode] = useState(() => hashParam("code") || "ALL"); // birinchi — umumiy (barcha aeroportlar), keyin aeroportlar bo'yicha
  const [slide, setSlideS] = useState(() => (hashParam("slide") != null ? Math.min(3, +(hashParam("slide") as string) || 0) : 0));
  const [playing, setPlaying] = useState(() => !(hashParam("slide") != null || hashParam("metric") || hashParam("code")));
  const [hold, setHold] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [dotKey, setDotKey] = useState(0);

  const k = metric, unit = unitOf(k), pr = useMemo(() => periods(D, ym, daily), [D, ym, daily]);
  const aps: Ap[] = useMemo(
    () => AP_LIST.map((a) => ({ code: a, cur: metricsOf(D, a, pr.from, pr.to), cmp: metricsOf(D, a, pr.cfrom, pr.cto, pr.ckey) })).filter((a) => COORDS[a.code]), // reysi yoʻq aeroportlar ham xaritada koʻrinadi
    [D, pr],
  );
  const max = Math.max(0, ...aps.map((a) => mVal(a.cur, k)));
  const tot: Record<string, { aps: Ap[]; v: number }> = {};
  aps.forEach((a) => { const r = AP_REGION[a.code]; if (!r) return; (tot[r] = tot[r] || { aps: [], v: 0 }).aps.push(a); tot[r].v += mVal(a.cur, k); });
  const regMax = Math.max(0, ...Object.keys(tot).map((r) => tot[r].v));
  const ranked = aps.slice().sort((a, b) => mVal(b.cur, k) - mVal(a.cur, k) || a.code.localeCompare(b.code));
  const total: Ap = useMemo(() => ({ code: "ALL", cur: metricsAll(D, pr.from, pr.to), cmp: metricsAll(D, pr.cfrom, pr.cto, pr.ckey) }), [D, pr]);
  const effCode = code === "ALL" || aps.some((a) => a.code === code) || !ranked.length ? code : ranked[0].code;
  const picked = effCode === "ALL" ? total : aps.filter((a) => a.code === effCode)[0];
  const pickedReg = picked && picked.code !== "ALL" ? AP_REGION[picked.code] : null;
  const allF = sum(aps.map((a) => a.cur), "flights");
  const tour = useMemo(() => ["ALL", ...tourCodes(D, ym, daily)], [D, ym, daily]);
  const place = Math.max(0, tour.indexOf(effCode)) + 1;
  const canPrev = ym.y * 12 + ym.m > first.y * 12 + first.m, canNext = ym.y * 12 + ym.m < cur.y * 12 + cur.m;

  // avtokoʻrsatuv: har SLIDE_MS da keyingi boʻlim / aeroport
  const st = useRef({ tour, effCode, slide });
  useEffect(() => { st.current = { tour, effCode, slide }; });
  useEffect(() => {
    if (!playing || hold) return;
    const id = setTimeout(() => {
      const { tour: tr, effCode: ec, slide: sl } = st.current;
      if (!tr.length) return;
      let ns = sl, nc = ec;
      if (sl + 1 < 4 && tr.indexOf(ec) >= 0) ns = sl + 1;
      else { nc = tr[(tr.indexOf(ec) + 1) % tr.length]; ns = 0; }
      setSlideS(ns); setCode(nc); setMetric(SHOW_METRIC[ns]);
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [playing, hold, effCode, slide, ym, daily]);

  const manual = () => setPlaying(false);
  const hv = hover ? tot[hover] : null;
  const foot = hover ? REG_NAME[hover] + ": " + (hv ? hv.aps.map((a) => a.code).join(", ") + " · " + showV(hv.v, k) + " " + unit : "aeroport yoʻq") : "Viloyat ustiga olib boring — undagi aeroportlar koʻrinadi.";

  return (
    <section className="vg__card vg__globe uzm">
      <header className="vg__card-head">
        <div>
          <h2 className="vg__title">Oʻzbekiston aeroportlari<span className="vg__badge vg__badge--dark">{N(allF)} ta operatsiya, {aps.filter((a) => a.cur.flights > 0).length} ta aeroport</span></h2>
          <p className="vg__hint">Mamlakat aeroportlari oy davomida nimani qabul qildi va joʻnatdi. Viloyat rangi — tanlangan koʻrsatkich boʻyicha. Viloyat yoki aeroportni bosing.</p>
        </div>
      </header>
      <div className="wmap__bar">
        <div className="uzm__month">
          <button disabled={!daily && !canPrev} aria-label="Oldingi oy" onClick={() => { if (daily) { setDaily(false); setYm(cur); } else setYm(addM(ym, -1)); }}><ChevL /></button>
          <b className="uzm__ttl">{ICONS.calendar}{daily ? "Bugun · " + dayLabel(pr.to) : monthName(ym)}</b>
          <button disabled={daily || !canNext} aria-label="Keyingi oy" onClick={() => setYm(addM(ym, 1))}><ChevR /></button>
          {daily ? null : <button type="button" aria-label="Bugun" title="Bugungi kun" style={{ width: "auto", padding: "0 10px" }} onClick={() => { setDaily(true); setYm(cur); }}>Bugun</button>}
        </div>
        <button className={"uzm__play" + (playing ? " on" : "")} title={playing ? "Avtokoʻrsatuvni toʻxtatish" : "Avtokoʻrsatuv: aeroportlar navbat bilan, har birining barcha boʻlimlari"}
          onClick={() => { if (!playing) setMetric(SHOW_METRIC[slide]); setPlaying(!playing); setHold(false); }}>
          {playing ? <PauseIcon /> : <PlayIcon />}
          <span>Avtokoʻrsatuv</span>
          {aps.length ? <small>{playing && hold ? "pauza" : place + " / " + tour.length}</small> : null}
        </button>
        <div className="wmap__seg">
          {METRICS.map((m) => <button key={m[0]} className={(k === m[0] ? "on" : "") + " uzm__tabbtn uzm__tabbtn--ic"} title={daily && m[0] === "flights" ? "Bajarilgan reyslar" : m[1]} aria-label={m[1]} onClick={() => { manual(); setMetric(m[0]); }}>{ICONS[({ flights: "dep", pax: "users", cargo: "cargo", fuel: "fuel" } as Record<string, string>)[m[0]]]}</button>)}
        </div>
      </div>
      <div className="uzm__body">
        <div className="uzm__mapcol">
          <div className="uzm__stage">
            <svg viewBox="-8 -8 1016 676" className="uzm__svg">
              {UZ_PATHS.map((r) => {
                const t = tot[r.iso], has = !!t, sh = has ? shade(t.v, regMax) : 0;
                return (
                  <path key={r.iso} d={r.d} className={"uzm__region" + (has ? " live" : "") + (pickedReg === r.iso ? " picked" : "") + (hover === r.iso ? " hot" : "")}
                    style={has ? { fill: `rgba(59, 130, 246, ${(0.08 + 0.38 * sh).toFixed(3)})` } : undefined}
                    onMouseEnter={() => setHover(r.iso)} onMouseLeave={() => setHover(null)}
                    onClick={has ? () => { const best = t.aps.slice().sort((a, b) => mVal(b.cur, k) - mVal(a.cur, k))[0]; manual(); setCode(best.code); } : undefined}>
                    <title>{REG_NAME[r.iso] + ": " + (has ? showV(t.v, k) + " " + unit : "aeroport yoʻq")}</title>
                  </path>
                );
              })}
              {UZ_PATHS.map((r) => {
                if (!NAMED[r.iso]) return null;
                const lx = r.label[0], ly = r.label[1] - 22;
                const near = aps.some((a) => { const c = COORDS[a.code]; if (!c) return false; const p = uzProject(c[0], c[1]); return Math.abs(p[0] - lx) < 90 && Math.abs(p[1] - ly) < 40; });
                return near ? null : <text key={"n" + r.iso} x={lx} y={ly} textAnchor="middle" className="uzm__rname">{REG_SHORT[r.iso]}</text>;
              })}
              {ranked.map((a) => {
                const c = COORDS[a.code];
                if (!c) return null;
                const p = uzProject(c[0], c[1]), v = mVal(a.cur, k), r = 5 + 11 * shade(v, max), on = a.code === effCode;
                const side = a.code === "TAS" ? "left" : a.code === "NMA" ? "up" : a.code === "FEG" ? "down" : "right";
                const lx = side === "left" ? p[0] - r - 6 : side === "right" ? p[0] + r + 6 : p[0];
                const ly = side === "up" ? p[1] - r - 18 : side === "down" ? p[1] + r + 14 : p[1] - 2;
                const an = side === "left" ? "end" : side === "right" ? "start" : "middle";
                return (
                  <g key={a.code} className={"uzm__pin" + (on ? " on" : "")} onClick={() => { manual(); setCode(a.code); }}>
                    {on ? <circle cx={p[0]} cy={p[1]} r={r + 7} className="uzm__ring" /> : null}
                    <circle cx={p[0]} cy={p[1]} r={+r.toFixed(1)} className="uzm__dot" />
                    <text x={lx} y={ly} textAnchor={an} className="uzm__code">{a.code}</text>
                    <title>{AP_FULL[a.code] + " (" + a.code + "): " + showV(v, k) + " " + unit}</title>
                  </g>
                );
              })}
            </svg>
            <div className="uzm__legend"><span>kamroq</span><i></i><span>koʻproq</span><span className="uzm__legend-none"><b></b>aeroport yoʻq</span></div>
          </div>
          <ul className="wmap__top">
            <li>
              <button className={effCode === "ALL" ? "on" : ""} title="Barcha aeroportlar boʻyicha umumiy" onClick={() => { manual(); setCode("ALL"); }}>
                <b>Σ</b><span>Umumiy</span>
              </button>
            </li>
            {ranked.map((a) => (
              <li key={a.code}>
                <button className={a.code === effCode ? "on" : ""} title={AP_FULL[a.code]} onClick={() => { manual(); setCode(a.code); }}>
                  <b>{a.code}</b><span>{AP_FULL[a.code]}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="wmap__foot">{foot}</div>
        </div>
        {picked ? (
          <Detail a={picked} pr={pr} k={k} unit={unit} ym={ym} slide={slide} playing={playing} hold={hold} dotKey={dotKey}
            setSlide={(n, stop) => { if (stop) manual(); setSlideS(n); }}
            onEnter={() => setHold(true)} onLeave={() => { setHold(false); setDotKey((d) => d + 1); }} />
        ) : (
          <div className="vg__float uzm__detail"><div className="vg__none">Bu oyda reyslar yoʻq</div></div>
        )}
      </div>
    </section>
  );
}
