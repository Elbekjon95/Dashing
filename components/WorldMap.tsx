"use client";
import { useMemo, useState } from "react";
import { LAND_ROWS } from "@/lib/static";
import { C, N } from "@/lib/format";
import { useLookups } from "@/lib/dash";
import { mapBox, proj } from "@/lib/uzcalc";
import { useWidth } from "./charts";

// quruqlik nuqtalari (bir marta hisoblanadi)
const LAND: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < LAND_ROWS.length; r++) {
    const rw = LAND_ROWS[r];
    for (let c = 0; c < rw.length; c++) if (rw.charCodeAt(c) === 35) out.push({ x: c * 2 + 1, y: r * 2 + 1 });
  }
  return out;
})();

export default function WorldMap({ homes, pairs, top = 8, unit = "reys", aspect = 2.4 }: { homes: string[]; pairs: { from: string; to: string; n: number }[]; top?: number; unit?: string; aspect?: number }) {
  const { placeName, country } = useLookups();
  const [ref, cw] = useWidth<HTMLDivElement>();
  const [hot, setHot] = useState<string | null>(null);

  const g = useMemo(() => {
    const dest: Record<string, { code: string; n: number }> = {};
    pairs.forEach((p) => { const o = (dest[p.to] = dest[p.to] || { code: p.to, n: 0 }); o.n += p.n; });
    const list = Object.keys(dest).map((x) => dest[x]).sort((a, b) => b.n - a.n);
    return { dest, list, mx: list.length ? list[0].n : 1 };
  }, [pairs]);

  const pts = homes.concat(g.list.map((d) => d.code)).map(proj).filter(Boolean) as [number, number][];
  const vb = mapBox(pts, aspect);
  const W = Math.max(260, cw || 800), H = Math.round((W * vb[3]) / vb[2]), k = vb[2] / W;

  const labelled: Record<string, number> = {};
  const placed: [number, number][] = [];
  g.list.filter((d) => homes.indexOf(d.code) < 0 && proj(d.code)).forEach((d) => {
    if (placed.length >= 6) return;
    const p = proj(d.code) as [number, number];
    if (placed.some((q) => Math.hypot((q[0] - p[0]) / k, (q[1] - p[1]) / k) < 34)) return;
    placed.push(p);
    labelled[d.code] = 1;
  });
  let missing = 0;
  g.list.forEach((d) => { if (!proj(d.code)) missing++; });
  const topList = g.list.filter((d) => homes.indexOf(d.code) < 0).slice(0, top);

  const foot = hot && g.dest[hot] ? hot + " — " + placeName(hot) + ", " + country(hot) + ": " + N(g.dest[hot].n) + " " + unit : (missing ? "Xaritada koʻrsatilmagan (koordinatasi yoʻq): " + missing + " ta aeroport. " : "") + "Nuqta ustiga olib boring — aeroport nomi chiqadi.";
  const on = (code: string) => ({ onMouseEnter: () => setHot(code), onMouseLeave: () => setHot(null) });

  return (
    <div ref={ref}>
      <svg className="wmap__svg" viewBox={vb.join(" ")} width={W} height={H}>
        <g className="wmap__land" style={{ "--lr": Math.min(0.72, 2.3 * k).toFixed(3) + "px" } as React.CSSProperties}>
          {LAND.map((c, i) => <circle key={i} cx={c.x} cy={c.y} />)}
        </g>
        {pairs.map((p, i) => {
          const a = proj(p.from), b = proj(p.to);
          if (!a || !b || p.from === p.to) return null;
          const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, bend = Math.min(18, len * 0.25);
          const cx = (a[0] + b[0]) / 2 + (dy / len) * bend * (dx > 0 ? -1 : 1), cy = (a[1] + b[1]) / 2 - Math.abs(dx / len) * bend;
          return <path key={i} className={"wmap__arc" + (hot === p.to ? " hot" : "")} d={`M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${cx.toFixed(2)},${cy.toFixed(2)} ${b[0].toFixed(2)},${b[1].toFixed(2)}`} strokeWidth={(1.2 * k).toFixed(3)} style={{ strokeDasharray: `${5 * k} ${6 * k}` }} />;
        })}
        {g.list.map((d) => {
          const p = proj(d.code);
          if (!p || homes.indexOf(d.code) >= 0) return null;
          const r = (4 + 9 * Math.sqrt(d.n / g.mx)) * k;
          return (
            <g key={d.code} {...on(d.code)}>
              <circle className={"wmap__bubble" + (hot === d.code ? " hot" : "")} cx={p[0]} cy={p[1]} r={+r.toFixed(2)} strokeWidth={1.2 * k} />
              {labelled[d.code] && r / k >= 8 ? <text className="wmap__count" x={p[0]} y={p[1] + 3.5 * k} textAnchor="middle" style={{ fontSize: 9.5 * k, fill: "#fff" }}>{C(d.n)}</text> : null}
            </g>
          );
        })}
        {homes.map((h, i) => {
          const p = proj(h);
          if (!p) return null;
          return (
            <g key={h}>
              <circle className="wmap__ring" cx={p[0]} cy={p[1]} r={9 * k} strokeWidth={1.5 * k} />
              <circle className="wmap__home" cx={p[0]} cy={p[1]} r={4 * k} />
              {i === 0 || homes.length <= 3 ? <text className="wmap__label" x={p[0] + 7 * k} y={p[1] - 6 * k} style={{ fontSize: 12 * k, fill: "#ffb374" }}>{h}</text> : null}
            </g>
          );
        })}
      </svg>
      <ul className="wmap__top">
        {topList.map((d) => (
          <li key={d.code}>
            <button className={hot === d.code ? "on" : ""} {...on(d.code)}>
              <b>{d.code}</b><span>{placeName(d.code)}</span><i>{C(d.n)}</i>
            </button>
          </li>
        ))}
      </ul>
      <div className="wmap__foot">{foot}</div>
    </div>
  );
}
