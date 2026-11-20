"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { WORLD_PATH } from "@/lib/worldpath";
import { C, N } from "@/lib/format";
import { useLookups } from "@/lib/dash";
import { mapBox, proj as projCode, UZ_PATHS } from "@/lib/uzcalc";
import { useWidth } from "./charts";

// Oʻzbekiston konturi dunyo xaritasi koordinatalarida (x = boylam + 180, y = 83 − kenglik)
const UZ_WORLD = UZ_PATHS.map((r) => r.d).join("").replace(/([ML])([0-9.]+),([0-9.]+)/g, (_m, c, x, y) => {
  const lon = +x / (0.751264 * 76.7199) + 55.9, lat = 45.7 - +y / 76.7199;
  return c + (lon + 180).toFixed(2) + "," + (83 - lat).toFixed(2);
});
export const UZ_HUB = "UZ"; // "barcha aeroportlar" rejimida markaz — butun Oʻzbekiston
const UZ_CENTER: [number, number] = [64.6 + 180, 83 - 41.4];
const proj = (code: string): [number, number] | null => (code === UZ_HUB ? UZ_CENTER : projCode(code));

type Pair = { from: string; to: string; n: number; r?: number };
const ARCS = 12; // doimiy koʻrinadigan chiziqlar soni (eng katta yoʻnalishlar)
const LABELS = 8; // yozuv qoʻyiladigan yoʻnalishlar soni

// hub berilsa: barcha aeroportlardan chiqqan qatnovlar manzil boʻyicha birlashtirilib, hub'dan bitta chiziq chiziladi
export default function WorldMap({ homes, pairs, hub, unit = "reys", aspect = 2.4, fill = false }: { homes: string[]; pairs: Pair[]; hub?: string; top?: number; unit?: string; aspect?: number; fill?: boolean }) {
  const { placeName, country } = useLookups();
  const [ref, cw] = useWidth<HTMLDivElement>();
  const [hot, setHot] = useState<string | null>(null);
  // fill: xarita ekran balandligini (100vh) toʻldiradi — xarita yuqorisidan ekran pastigacha
  const [scr, setScr] = useState({ vh: 900, top: 0 });
  useEffect(() => {
    if (!fill) return;
    const f = () => { const r = ref.current?.getBoundingClientRect(); setScr({ vh: window.innerHeight, top: r ? r.top + window.scrollY : 0 }); };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [fill, cw, ref]);
  const aspectEff = fill ? Math.max(1.2, (cw || 800) / Math.max(320, scr.vh - scr.top - 70)) : aspect;

  const eff = useMemo<Pair[]>(() => {
    if (!hub) return pairs;
    const m: Record<string, Pair> = {};
    pairs.forEach((p) => { if (homes.indexOf(p.to) >= 0) return; const o = (m[p.to] = m[p.to] || { from: hub, to: p.to, n: 0, r: 0 }); o.n += p.n; o.r = (o.r || 0) + (p.r || 0); });
    return Object.keys(m).map((k) => m[k]);
  }, [pairs, hub, homes]);

  const g = useMemo(() => {
    const dest: Record<string, { code: string; n: number; r: number }> = {};
    eff.forEach((p) => { const o = (dest[p.to] = dest[p.to] || { code: p.to, n: 0, r: 0 }); o.n += p.n; o.r += p.r || 0; });
    const list = Object.keys(dest).map((x) => dest[x]).sort((a, b) => b.n - a.n);
    return { dest, list, mx: list.length ? list[0].n : 1 };
  }, [eff]);

  const shown = hub ? [hub] : homes; // markaz belgilari (hub = UZ — butun Oʻzbekiston)
  const pts = shown.concat(g.list.map((d) => d.code)).map(proj).filter(Boolean) as [number, number][];
  const vb0 = mapBox(pts, aspectEff);
  const W = Math.max(260, cw || 800), H = Math.round((W * vb0[3]) / vb0[2]);

  // zoom / surish: koʻrinish oynasi (viewBox) markazi va kattalashtirish; markaz oʻzgarsa (aeroport tanlansa) boshlangʻich holatga qaytadi
  const viewKey = (hub || "") + "|" + homes.join(",");
  const [zs, setZs] = useState({ key: "", z: 1, cx: 0, cy: 0 });
  const cur = zs.key === viewKey ? zs : { key: viewKey, z: 1, cx: vb0[0] + vb0[2] / 2, cy: vb0[1] + vb0[3] / 2 };
  const boxOf = (z: number, cx: number, cy: number): number[] => {
    if (z <= 1) return vb0;
    const w = vb0[2] / z, h = vb0[3] / z;
    const x = Math.min(Math.max(cx - w / 2, 0), 360 - w), y = Math.min(Math.max(cy - h / 2, 0), 140 - h);
    return [x, y, w, h];
  };
  const vb = boxOf(cur.z, cur.cx, cur.cy);
  const k = vb[2] / W; // belgilar ekranda bir xil oʻlchamda qoladi
  const zoomAt = (prev: typeof cur, f: number, fx = 0.5, fy = 0.5) => {
    const nz = Math.min(14, Math.max(1, prev.z * f));
    const b = boxOf(prev.z, prev.cx, prev.cy);
    const wx = b[0] + fx * b[2], wy = b[1] + fy * b[3];
    const nw = vb0[2] / nz, nh = vb0[3] / nz;
    if (nz <= 1) return { key: viewKey, z: 1, cx: vb0[0] + vb0[2] / 2, cy: vb0[1] + vb0[3] / 2 };
    const nb = boxOf(nz, wx - fx * nw + nw / 2, wy - fy * nh + nh / 2);
    return { key: viewKey, z: nz, cx: nb[0] + nb[2] / 2, cy: nb[1] + nb[3] / 2 };
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [grab, setGrab] = useState(false);
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      setZs((prev) => zoomAt(prev.key === viewKey ? prev : { key: viewKey, z: 1, cx: vb0[0] + vb0[2] / 2, cy: vb0[1] + vb0[3] / 2 }, e.deltaY < 0 ? 1.25 : 0.8, fx, fy));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, vb0.join(",")]);
  const onDown = (e: React.PointerEvent) => { if (cur.z <= 1) return; drag.current = { x: e.clientX, y: e.clientY, moved: false }; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setGrab(true); };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.x) * k, dy = (e.clientY - d.y) * k;
    d.x = e.clientX; d.y = e.clientY; d.moved = true;
    setZs((prev) => { const c = prev.key === viewKey ? prev : cur; const b = boxOf(c.z, c.cx - dx, c.cy - dy); return { key: viewKey, z: c.z, cx: b[0] + b[2] / 2, cy: b[1] + b[3] / 2 }; });
  };
  const onUp = () => { drag.current = null; setGrab(false); };
  const zin = () => setZs((p) => zoomAt(p.key === viewKey ? p : cur, 1.6));
  const zout = () => setZs((p) => zoomAt(p.key === viewKey ? p : cur, 1 / 1.6));
  const zreset = () => setZs({ key: viewKey, z: 1, cx: vb0[0] + vb0[2] / 2, cy: vb0[1] + vb0[3] / 2 });

  const foreign = g.list.filter((d) => homes.indexOf(d.code) < 0 && proj(d.code));
  const topSet = new Set(foreign.slice(0, ARCS).map((d) => d.code));
  const leader: Record<string, number> = {};
  { const best: Record<string, number> = {}; eff.forEach((p, i) => { if (topSet.has(p.to) && p.from !== p.to && p.n > (best[p.to] ?? -1)) { best[p.to] = p.n; leader[p.to] = i; } }); }

  // yozuvlar: toʻqnashmaydigan joyga qoʻyiladi, kerak boʻlsa doiradan uzoqlashtirilib ingichka chiziq bilan bogʻlanadi
  const LW = 62 * k, LH = 27 * k;
  const labels = (() => {
    const out: { code: string; x: number; y: number; px: number; py: number; far: boolean }[] = [];
    const boxes: [number, number][] = [];
    shown.forEach((h) => { const p = proj(h); if (p) boxes.push([p[0] + 14 * k, p[1] - 8 * k]); });
    foreign.slice(0, LABELS).forEach((d) => {
      const p = proj(d.code) as [number, number];
      const r = 3.5 + 10 * Math.sqrt(d.n / g.mx);
      const e = r + 16, f = r + 34;
      const cand: [number, number][] = [[0, -e], [0, e], [f, 0], [-f, 0], [f * 0.8, -e], [-f * 0.8, -e], [f * 0.8, e], [-f * 0.8, e], [0, -e * 2], [0, e * 2], [f * 1.7, -e], [-f * 1.7, -e], [f * 1.7, e], [-f * 1.7, e], [f * 2.2, 0], [-f * 2.2, 0]];
      for (const [ox, oy] of cand) {
        const x = p[0] + ox * k, y = p[1] + oy * k;
        if (x - LW / 2 < vb[0] || x + LW / 2 > vb[0] + vb[2] || y - LH / 2 < vb[1] || y + LH / 2 > vb[1] + vb[3]) continue;
        if (boxes.some((b) => Math.abs(b[0] - x) < LW && Math.abs(b[1] - y) < LH)) continue;
        boxes.push([x, y]);
        out.push({ code: d.code, x, y, px: p[0], py: p[1], far: Math.hypot(ox, oy) > e + 2 });
        break;
      }
    });
    return out;
  })();

  let missing = 0;
  g.list.forEach((d) => { if (!proj(d.code)) missing++; });

  const foot = ((missing ? "Xaritada koʻrsatilmagan (koordinatasi yoʻq): " + missing + " ta aeroport. " : "") + "Doira ustiga olib boring — chiziq va aeroport nomi chiqadi.");
  const on = (code: string) => ({ onMouseEnter: () => setHot(code), onMouseLeave: () => setHot(null) });

  return (
    <div ref={ref} className="wmapw">
      <svg ref={svgRef} className={"wmap__svg" + (cur.z > 1 ? " zoomed" : "") + (grab ? " grab" : "")} viewBox={vb.join(" ")} width={W} height={H} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <defs>
          <radialGradient id="wmBub" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#e9fff9" stopOpacity="0.95" /><stop offset="0.6" stopColor="#8ad4c4" stopOpacity="0.85" /><stop offset="1" stopColor="#2a9d8f" stopOpacity="0.8" /></radialGradient>
          <radialGradient id="wmHome" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ff9a4d" stopOpacity="0.55" /><stop offset="1" stopColor="#ff9a4d" stopOpacity="0" /></radialGradient>
        </defs>
        <rect className="wmap__sea" x={0} y={0} width={360} height={140} />
        <g className="wmap__grat" strokeWidth={0.6 * k}>
          {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((x) => <line key={"m" + x} x1={x} x2={x} y1={0} y2={140} />)}
          {[23, 53, 83, 113].map((y) => <line key={"p" + y} x1={0} x2={360} y1={y} y2={y} />)}
        </g>
        <path className="wmap__world" d={WORLD_PATH} />
        <path className={"wmap__uz" + (hub === UZ_HUB ? " on" : "")} d={UZ_WORLD} />
        {eff.map((p, i) => {
          const isTop = topSet.has(p.to), isHot = hot === p.to;
          if (!isTop && !isHot) return null; // qolgan yoʻnalishlar faqat doira sifatida; ustiga olib borilganda chizigʻi chiqadi
          const a = proj(p.from), b = proj(p.to);
          if (!a || !b || p.from === p.to) return null;
          const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, bend = Math.min(18, len * 0.25);
          const cx = (a[0] + b[0]) / 2 + (dy / len) * bend * (dx > 0 ? -1 : 1), cy = (a[1] + b[1]) / 2 - Math.abs(dx / len) * bend;
          const share = Math.sqrt((g.dest[p.to]?.n || 0) / g.mx);
          const cls = "wmap__arc top" + (isHot ? " hot" : hot ? " dim" : "");
          const d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${cx.toFixed(2)},${cy.toFixed(2)} ${b[0].toFixed(2)},${b[1].toFixed(2)}`;
          const lead = leader[p.to] === i;
          return (
            <g key={i}>
              <path className={cls} d={d} strokeWidth={((0.8 + 1.4 * share) * k).toFixed(3)} />
              {lead && !hot ? (
                <circle className="wmap__dot" r={(1.9 + 1.4 * share) * k}>
                  <animateMotion dur={(8 + (i % 5) * 1.4).toFixed(1) + "s"} begin={((i % 7) * -1.3).toFixed(1) + "s"} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1" />
                </circle>
              ) : null}
            </g>
          );
        })}
        {labels.map((l) => (l.far ? <line key={"l" + l.code} className={"wmap__lead" + (hot && hot !== l.code ? " wmap__dim" : "")} x1={l.px} y1={l.py} x2={l.x} y2={l.y} strokeWidth={0.8 * k} /> : null))}
        {g.list.map((d) => {
          const p = proj(d.code);
          if (!p || homes.indexOf(d.code) >= 0) return null;
          const r = (3.5 + 10 * Math.sqrt(d.n / g.mx)) * k;
          return (
            <g key={d.code} {...on(d.code)} className={hot && hot !== d.code ? "wmap__dim" : undefined}>
              <circle className={"wmap__bubble" + (hot === d.code ? " hot" : "")} cx={p[0]} cy={p[1]} r={+r.toFixed(2)} strokeWidth={1 * k} />
            </g>
          );
        })}
        {labels.map((l) => {
          const d = g.dest[l.code];
          return (
            <g key={"t" + l.code} {...on(l.code)} className={"wmap__tag" + (hot && hot !== l.code ? " wmap__dim" : "")}>
              <rect x={l.x - LW / 2} y={l.y - LH / 2} width={LW} height={LH} rx={5 * k} strokeWidth={0.8 * k} />
              <text x={l.x} y={l.y - 2 * k} textAnchor="middle" style={{ fontSize: 10.5 * k }}>{l.code}</text>
              <text className="wmap__tagn" x={l.x} y={l.y + 8.5 * k} textAnchor="middle" style={{ fontSize: 9 * k }}>{C(d.n)}</text>
            </g>
          );
        })}
        {shown.map((h, i) => {
          const p = proj(h);
          if (!p) return null;
          return (
            <g key={h}>
              <circle cx={p[0]} cy={p[1]} r={13 * k} fill="url(#wmHome)" />
              <circle className="wmap__ring" cx={p[0]} cy={p[1]} r={9 * k} strokeWidth={1.5 * k} />
              <circle className="wmap__home" cx={p[0]} cy={p[1]} r={3.6 * k} />
              {i === 0 || shown.length <= 3 ? <text className="wmap__label" x={p[0] + 7 * k} y={p[1] - 6 * k} style={{ fontSize: 12 * k, strokeWidth: 3 * k }}>{h === UZ_HUB ? "Oʻzbekiston" : h}</text> : null}
            </g>
          );
        })}
      </svg>
      <div className="wmap__zoom">
        <button type="button" title="Kattalashtirish" aria-label="Kattalashtirish" onClick={zin}>+</button>
        <button type="button" title="Kichraytirish" aria-label="Kichraytirish" onClick={zout} disabled={cur.z <= 1}>−</button>
        <button type="button" title="Boshlangʻich koʻrinish" aria-label="Boshlangʻich koʻrinish" onClick={zreset} disabled={cur.z <= 1}>⟲</button>
      </div>
      {hot && g.dest[hot] && proj(hot) ? (() => {
        const q = proj(hot) as [number, number], x = Math.min(Math.max((q[0] - vb[0]) / k, 110), W - 110), y = (q[1] - vb[1]) / k, d = g.dest[hot];
        return (
          <div className="wmap__tip" style={{ left: x, top: Math.max(y - 16, 70) }}>
            <b>{placeName(hot)} <i>{hot}</i></b>
            <span>{country(hot)}</span>
            <div><em>{N(d.r)}</em> qatnov (reys)</div>
            <div><em>{N(d.n)}</em> {unit}</div>
          </div>
        );
      })() : null}
      <div className="wmap__foot">{foot}</div>
    </div>
  );
}
