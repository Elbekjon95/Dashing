/* eslint-disable @typescript-eslint/no-explicit-any */
import { AP_LIST, COORDS, OY_T, UZ_REGIONS } from "./static";
import { todayStr } from "./dash";

// ---------------------------------------------------------------- geografiya
export const uzProject = (lat: number, lon: number): [number, number] => [(lon - 55.9) * 0.751264 * 76.7199, (45.7 - lat) * 76.7199];

function inRing(x: number, y: number, ring: number[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function regionOf(lat: number, lon: number): string | null {
  const p = uzProject(lat, lon);
  const ordered = UZ_REGIONS.slice().sort((a, b) => Number(b.iso === "UZ-TK") - Number(a.iso === "UZ-TK"));
  for (const r of ordered) if (r.rings.some((rg) => inRing(p[0], p[1], rg))) return r.iso;
  let best: string | null = null, bd = 40;
  UZ_REGIONS.forEach((r) => {
    const d = Math.hypot(r.label[0] - p[0], r.label[1] - p[1]);
    if (d < bd) { bd = d; best = r.iso; }
  });
  return best;
}

export const UZ_PATHS = UZ_REGIONS.map((r) => ({
  iso: r.iso,
  label: r.label,
  d: r.rings.map((rg) => { let d = ""; for (let i = 0; i < rg.length; i += 2) d += (i === 0 ? "M" : "L") + rg[i] + "," + rg[i + 1]; return d + "Z"; }).join(""),
}));

export const AP_REGION: Record<string, string | null> = {};
AP_LIST.forEach((a) => { const c = COORDS[a]; AP_REGION[a] = c ? regionOf(c[0], c[1]) : null; });

export const NAMED: Record<string, number> = { "UZ-QR": 1, "UZ-NW": 1, "UZ-BU": 1, "UZ-XO": 1, "UZ-QA": 1, "UZ-SU": 1, "UZ-SA": 1, "UZ-JI": 1 };
export const METRICS: [string, string, string][] = [["flights", "Reyslar", "reys"], ["pax", "Yoʻlovchilar", "yoʻlovchi"], ["cargo", "Yuk aylanmasi", "t"], ["fuel", "Yoqilgʻi", "t"]];
export const SHOW_METRIC = ["flights", "pax", "cargo", "fuel"];
export const SLIDE_MS = 6000;

// ---------------------------------------------------------------- hisob-kitob
export type YM = { y: number; m: number };
export const shade = (v: number, max: number) => (v <= 0 || max <= 0 ? 0 : Math.min(1, Math.sqrt(v / max)));
export const unitOf = (k: string) => METRICS.filter((m) => m[0] === k)[0][2];
export const dim = (y: number, m: number) => new Date(y, m, 0).getDate();
export const ymStr = (ym: YM) => ym.y + "-" + String(ym.m).padStart(2, "0");
export const addM = (ym: YM, s: number): YM => { const n = ym.y * 12 + ym.m - 1 + s; return { y: Math.floor(n / 12), m: (n % 12) + 1 }; };
export const monthName = (ym: YM) => OY_T[ym.m - 1] + " " + ym.y;

type XK = { src: any; ci: Record<string, number>; by: Record<string, any[]>; first: string };
const xkCache = new WeakMap<object, Record<string, XK>>();
// key="kecha": kechagi kunning hozirgi soatgacha boʻlgan qismi (sql/tez/kecha.sql); yoʻq boʻlsa — butun kun (xarita_kun).
// key="xarita_kun": tarix (sekin) + bugungi kun (sql/tez/xarita_bugun.sql, har 5 daqiqada yangilanadi) birlashtiriladi.
export function xkIndex(D: any, key = "xarita_kun"): XK {
  const cacheFor = (xkCache.get(D) || xkCache.set(D, {}).get(D)) as Record<string, XK>;
  if (cacheFor[key]) return cacheFor[key];
  let src = D[key] || D.xarita_kun || { cols: [], rows: [] };
  if (key === "xarita_kun" && D.xarita_bugun && D.xarita_bugun.rows && src.cols.length) {
    const ki = src.cols.indexOf("kun");
    const fresh = new Set<string>(D.xarita_bugun.rows.map((r: any[]) => r[ki]));
    src = { cols: src.cols, rows: src.rows.filter((r: any[]) => !fresh.has(r[ki])).concat(D.xarita_bugun.rows) };
  }
  const ci: Record<string, number> = {};
  src.cols.forEach((c: string, i: number) => { ci[c] = i; });
  const by: Record<string, any[]> = {};
  src.rows.forEach((r: any[]) => { (by[r[ci.ap]] = by[r[ci.ap]] || []).push(r); });
  const days = src.rows.map((r: any[]) => r[ci.kun]).sort();
  const x = { src, ci, by, first: days[0] || todayStr(D) };
  cacheFor[key] = x;
  return x;
}

export const zeroM = () => ({ flights: 0, cancelled: 0, pax: 0, pax_arr: 0, pax_dep: 0, cargo_kg: 0, mail_kg: 0, baggage_kg: 0, fuel_kg: 0, with_load: 0, ms: 0, ot: 0, dl: 0, dm: 0, df: 0, dp: 0, dc: 0, du: 0 });
export type M = ReturnType<typeof zeroM>;

export function metricsOf(D: any, ap: string, from: string, to: string, key = "xarita_kun"): M {
  const x = xkIndex(D, key), ci = x.ci, m = zeroM();
  (x.by[ap] || []).forEach((r) => {
    const k = r[ci.kun];
    if (k < from || k > to) return;
    m.flights += r[ci.f]; m.cancelled += r[ci.b]; m.pax_arr += r[ci.pa]; m.pax_dep += r[ci.pd]; m.cargo_kg += r[ci.c]; m.mail_kg += r[ci.m];
    m.baggage_kg += r[ci.g]; m.fuel_kg += r[ci.u]; m.with_load += r[ci.wl]; m.ms += r[ci.ms]; m.ot += r[ci.ot]; m.dl += r[ci.dl]; m.dm += r[ci.dm];
    m.df += r[ci.df]; m.dp += r[ci.dp]; m.dc += r[ci.dc]; m.du += r[ci.du];
  });
  m.pax = m.pax_arr + m.pax_dep;
  return m;
}
// Bugun/kecha — uchish (tt=1) va qoʻnish (tt=2) boʻyicha: rej=jami reja, bek=bekor, baj=bajarilgan, pax=bajarilganlardagi yoʻlovchi,
// hz_*=kunning hozirgi soatigacha boʻlgan qismi (sql/tez/bugun.sql)
export function dirOf(D: any, ap: string, k: "bugun" | "kecha", tt: 1 | 2) {
  const t = { rej: 0, bek: 0, baj: 0, pax: 0, hz_baj: 0, hz_pax: 0 };
  ((D && D.bugun) || []).forEach((r: any) => {
    if (r.k !== k || r.tt !== tt || (ap !== "ALL" && r.ap !== ap)) return;
    t.rej += r.rej || 0; t.bek += r.bek || 0; t.baj += r.baj || 0; t.pax += r.pax || 0; t.hz_baj += r.hz_baj || 0; t.hz_pax += r.hz_pax || 0;
  });
  return t;
}

export function metricsAll(D: any, from: string, to: string, key = "xarita_kun"): M {
  const t = zeroM() as Record<string, number>;
  AP_LIST.forEach((a) => { const m = metricsOf(D, a, from, to, key) as Record<string, number>; for (const k in m) t[k] += m[k]; });
  return t as M;
}
export const mVal =(m: any, k: string) => (k === "flights" ? m.flights : k === "pax" ? m.pax : k === "cargo" ? (m.cargo_kg + m.mail_kg) / 1000 : m.fuel_kg / 1000);
export const mDom = (m: any, k: string) => (k === "flights" ? m.df : k === "pax" ? m.dp : k === "cargo" ? m.dc / 1000 : m.du / 1000);

const dayIso = (y: number, m: number, d: number) => { const t = new Date(y, m - 1, d); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); };
export const dayLabel = (s: string) => +s.slice(8, 10) + " " + OY_T[+s.slice(5, 7) - 1].toLowerCase();

// daily=true: bugungi kun (Toshkent vaqti, 00:00 dan) — kecha bilan solishtiriladi; mfrom/mto — joriy oy boshidan bugungacha
export function periods(D: any, ym: YM, daily = false) {
  const today = todayStr(D), ty = +today.slice(0, 4), tm = +today.slice(5, 7);
  const running = ym.y === ty && ym.m === tm;
  const mfrom = ymStr(ym) + "-01";
  const mto = running ? today : ymStr(ym) + "-" + String(dim(ym.y, ym.m)).padStart(2, "0");
  const days = +mto.slice(8, 10), p = addM(ym, -1);
  const cfrom = ymStr(p) + "-01", cto = ymStr(p) + "-" + String(Math.min(days, dim(p.y, p.m))).padStart(2, "0");
  if (daily) {
    const yd = dayIso(ty, tm, +today.slice(8, 10) - 1);
    return { from: today, to: today, running, cfrom: yd, cto: yd, prev: p, daily: true, mfrom, mto, ckey: "kecha", gacha: (D.kecha && D.kecha.gacha) || "" };
  }
  return { from: mfrom, to: mto, running, cfrom, cto, prev: p, daily: false, mfrom, mto, ckey: "xarita_kun", gacha: "" };
}

export function topRows(D: any, t: string, oy: string, ap: string) {
  const src = D.xarita_top || { cols: [], rows: [] };
  const ci: Record<string, number> = {};
  src.cols.forEach((c: string, i: number) => { ci[c] = i; });
  return src.rows
    .filter((r: any[]) => r[ci.t] === t && r[ci.oy] === oy && r[ci.ap] === ap)
    .map((r: any[]) => ({ k: r[ci.k] as string, m: { flights: r[ci.f], pax: r[ci.p], cargo_kg: r[ci.c], mail_kg: 0, fuel_kg: r[ci.u] } }));
}

export function tourCodes(D: any, ym: YM, daily = false) {
  const pr = periods(D, ym, daily);
  return AP_LIST.map((a) => ({ a, f: metricsOf(D, a, pr.from, pr.to).flights }))
    .filter((x) => x.f > 0)
    .sort((a, b) => b.f - a.f || a.a.localeCompare(b.a))
    .map((x) => x.a);
}

// ---------------------------------------------------------------- dunyo xaritasi
export function proj(code: string): [number, number] | null {
  const c = COORDS[code];
  return c ? [c[1] + 180, 83 - c[0]] : null;
}
export function mapBox(points: [number, number][], aspect: number): number[] {
  if (!points.length) return [0, 0, 360, 140];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  points.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  const pad = 14;
  let w = Math.max(90, x1 - x0 + 2 * pad), h = y1 - y0 + 2 * pad;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  if (w > 360) { w = 360; h = w / aspect; }
  if (h > 140) { h = 140; w = Math.min(360, h * aspect); }
  return [+Math.min(Math.max(0, cx - w / 2), 360 - w).toFixed(2), +Math.min(Math.max(0, cy - h / 2), 140 - h).toFixed(2), +w.toFixed(2), +h.toFixed(2)];
}
