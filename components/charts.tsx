/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { C, N, P, nice } from "@/lib/format";
import { TipRow, useTip } from "@/lib/dash";

export const FILL: Record<string, { g: string; sw: string; line: string }> = {
  teal: { g: "url(#gTeal)", sw: "var(--c-pri)", line: "var(--c-pri)" },
  orange: { g: "url(#gOrange)", sw: "var(--c-sec)", line: "var(--c-sec)" },
  mint: { g: "url(#gMint)", sw: "#38bdf8", line: "#38bdf8" },
  blue: { g: "url(#gBlue)", sw: "#818cf8", line: "#818cf8" },
  grey: { g: "url(#gGrey)", sw: "#64748b", line: "#64748b" },
  red: { g: "url(#gRed)", sw: "#f43f5e", line: "#f43f5e" },
};

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => setW(el.clientWidth);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export const None = () => <div className="vg__none">Maʼlumot yoʻq</div>;

function Legend({ items }: { items: { name: string; fill: string; line?: boolean }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="vg__legend">
      {items.map((s) => (
        <span key={s.name}>
          <i className={s.line ? "ln" : ""} style={{ background: FILL[s.fill]?.sw || s.fill }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function XLabels({ n, pw, X, labels, H, minW }: { n: number; pw: number; X: (i: number) => number; labels: string[]; H: number; minW?: number }) {
  const maxL = Math.max(1, Math.floor(pw / (minW || 46)));
  const step = Math.ceil(n / maxL);
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i += step)
    out.push(
      <text key={i} x={X(i)} y={H - 4} textAnchor="middle">
        {labels[i]}
      </text>,
    );
  return <>{out}</>;
}

// ---------------------------------------------------------------- yangi: mini sparkline (KPI va 5 yillik kartalar uchun)
export function Sparkline({ values, color = "#3b82f6", h = 30, w = 120 }: { values: number[]; color?: string; h?: number; w?: number }) {
  const uid = useId().replace(/:/g, "");
  if (!values.length) return null;
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const span = mx - mn || 1;
  const padY = 4;
  const pts: [number, number][] = values.map((v, i) => [
    values.length <= 1 ? w / 2 : (i * (w - 6)) / (values.length - 1) + 3,
    h - padY - ((v - mn) / span) * (h - padY * 2),
  ]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const mxp = (pts[i - 1][0] + pts[i][0]) / 2;
    d += ` C${mxp.toFixed(1)},${pts[i - 1][1].toFixed(1)} ${mxp.toFixed(1)},${pts[i][1].toFixed(1)} ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
  }
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="vg__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${uid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------- yangi: radial segmentli yoy ko'rsatkich (Bugun o'z vaqtida)
export function Gauge({ pct, label = "oʻz vaqtida", color = "#3b82f6" }: { pct: number | null; label?: string; color?: string }) {
  const R = 42;
  const span = 240; // 240 gradusli zamonaviy yoy
  const circ = 2 * Math.PI * R;
  const arcLen = (span / 360) * circ;
  const fillLen = pct == null ? 0 : Math.max(0, Math.min(1, pct / 100)) * arcLen;
  const ticks = 13;
  return (
    <svg viewBox="0 0 110 100" className="vg__gauge">
      {Array.from({ length: ticks }, (_, i) => {
        const ang = ((-210 + (i * span) / (ticks - 1)) * Math.PI) / 180;
        const x1 = 55 + Math.cos(ang) * 33;
        const y1 = 54 + Math.sin(ang) * 33;
        const x2 = 55 + Math.cos(ang) * 36;
        const y2 = 54 + Math.sin(ang) * 36;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--v-line-hi)" strokeWidth="1.2" strokeLinecap="round" />;
      })}
      <circle
        cx="55" cy="54" r={R} fill="none" stroke="var(--v-track)" strokeWidth="7.5" strokeLinecap="round"
        strokeDasharray={`${arcLen.toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(150 55 54)"
      />
      {pct != null && fillLen > 0 ? (
        <circle
          cx="55" cy="54" r={R} fill="none" stroke={color} strokeWidth="7.5" strokeLinecap="round"
          strokeDasharray={`${fillLen.toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(150 55 54)"
          style={{ transition: "stroke-dasharray 0.45s cubic-bezier(.22,1,.36,1)" }}
        />
      ) : null}
      <text x="55" y="55" textAnchor="middle" className="vg__gauge-v">{pct == null ? "—" : pct + "%"}</text>
      <text x="55" y="70" textAnchor="middle" className="vg__gauge-l">{label}</text>
    </svg>
  );
}

// ---------------------------------------------------------------- yangi: segmentli proporsional kapsula chiziq
export function ProportionalBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const tot = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (!tot) return null;
  return (
    <div className="vg__pbar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
      {segments.filter((s) => s.value > 0).map((s) => (
        <span key={s.label} title={`${s.label}: ${N(s.value)} (${P(s.value / tot)})`} style={{ width: `${(s.value / tot) * 100}%`, background: s.color }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- zamonaviy kapsula ustunli grafik (hover fokus + fon trek + nowIdx)
export type BarSeries = { name: string; fill: string; values: (number | null)[]; faint?: boolean[] };
export function Bars(cfg: {
  labels: string[];
  tips?: string[];
  series: BarSeries[];
  fmt: (v: number) => string;
  fmtAxis?: (v: number) => string;
  h?: number;
  labelW?: number;
  stack?: boolean;
  note?: (i: number) => string;
  nowIdx?: number;
}) {
  const [ref, cw] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const [hov, setHov] = useState<number | null>(null);
  const W = Math.max(260, cw || 600), H = cfg.h || 230, m = { l: 48, r: 10, t: 14, b: 22 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b, n = cfg.labels.length, ns = cfg.series.length;
  const tot = cfg.labels.map((_, i) => cfg.series.reduce((a, s) => a + (+(s.values[i] as number) || 0), 0));
  const maxOf = (a: number[]) => a.reduce((m, v) => (v > m ? v : m), -Infinity);
  const mx = cfg.stack ? maxOf(tot) : maxOf(cfg.series.map((s) => maxOf(s.values.map((v) => +(v as number) || 0))));

  let body: ReactNode;
  if (!(mx > 0)) body = <None />;
  else {
    const t = nice(0, mx, 4), bw = pw / n, fa = cfg.fmtAxis || C;
    const Y = (v: number) => m.t + ph - (v / t.hi) * ph;
    const els: ReactNode[] = [];
    t.ticks.forEach((v) => {
      els.push(<line key={"g" + v} className="g-grid" x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} />);
      els.push(
        <text key={"t" + v} x={m.l - 8} y={Y(v) + 4} textAnchor="end">
          {fa(v)}
        </text>,
      );
    });

    // Hozirgi soat vertikal ko'rsatkichi (agar berilgan bo'lsa)
    if (cfg.nowIdx != null && cfg.nowIdx >= 0 && cfg.nowIdx < n) {
      const nx = m.l + bw * cfg.nowIdx + bw / 2;
      els.push(
        <g key="now-marker" className="g-now">
          <line x1={nx} x2={nx} y1={m.t} y2={m.t + ph} stroke="var(--v-teal)" strokeWidth="1.2" strokeDasharray="3 3" />
          <rect x={nx - 16} y={m.t - 12} width="32" height="13" rx="6" fill="var(--v-teal)" />
          <text x={nx} y={m.t - 2.5} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 700, fill: "#ffffff" }}>UTC</text>
        </g>,
      );
    }

    for (let i = 0; i < n; i++) {
      const x0 = m.l + bw * i;
      const isHov = hov === i;
      const dim = hov != null && !isHov ? 0.34 : 1;

      if (isHov) {
        els.push(<rect key={"spot" + i} x={x0 + 1} y={m.t} width={Math.max(2, bw - 2)} height={ph} rx="6" className="g-spot" />);
      }

      if (cfg.stack) {
        const w = Math.max(2.5, Math.min(28, bw * 0.56));
        let base = 0;
        const segs: { v: number; f: string }[] = [];
        cfg.series.forEach((se) => {
          const v = +(se.values[i] as number) || 0;
          if (v > 0) segs.push({ v, f: se.fill });
        });
        if (!segs.length) {
          els.push(<rect key={`trk${i}`} x={x0 + (bw - w) / 2} y={m.t} width={w} height={ph} rx={Math.min(4, w / 2)} className="g-rail" opacity={0.35} />);
        }
        segs.forEach((sg, k) => {
          const y0 = Y(base), y1 = Y(base + sg.v), gap = k > 0 ? 2 : 0, h = Math.max(0, y0 - y1 - gap);
          const rx = k === segs.length - 1 ? Math.min(4, w / 2, h / 2) : 1;
          if (h > 0) els.push(<rect key={`s${i}-${k}`} x={x0 + (bw - w) / 2} y={y0 - gap - h} width={w} height={h} rx={rx} fill={FILL[sg.f]?.sw || FILL[sg.f]?.g} opacity={dim} style={{ transition: "opacity 0.15s ease" }} />);
          base += sg.v;
        });
      } else {
        const inner = Math.min(bw * 0.78, ns * 22), bwi = Math.max(2, inner / ns - 2), start = x0 + (bw - inner) / 2;
        cfg.series.forEach((se, k) => {
          const v = +(se.values[i] as number) || 0;
          const bx = start + k * (bwi + 2);
          if (v <= 0) return;
          const h = m.t + ph - Y(v);
          const rx = Math.min(4, bwi / 2, h / 2);
          const op = se.faint && se.faint[i] ? dim * 0.45 : dim;
          els.push(<rect key={`b${i}-${k}`} x={bx} y={Y(v)} width={bwi} height={h} rx={rx} fill={FILL[se.fill]?.sw || FILL[se.fill]?.g} opacity={op} style={{ transition: "opacity 0.15s ease" }} />);
        });
      }

      els.push(
        <rect
          key={"band" + i}
          className="g-band"
          x={x0}
          y={m.t}
          width={bw}
          height={ph}
          onMouseMove={(e) => {
            setHov(i);
            const note = cfg.note && cfg.note(i);
            tip.show(
              <>
                <div className="h">{cfg.tips ? cfg.tips[i] : cfg.labels[i]}</div>
                {cfg.series.map((se) => (
                  <TipRow key={se.name} sw={FILL[se.fill]?.sw} name={se.name} val={cfg.fmt(+(se.values[i] as number) || 0)} />
                ))}
                {cfg.stack && ns > 1 ? <TipRow name="Jami" val={cfg.fmt(tot[i])} /> : null}
                {note ? <div style={{ color: "var(--v-muted)", marginTop: 4 }}>{note}</div> : null}
              </>,
              e,
            );
          }}
          onMouseLeave={() => { setHov(null); tip.hide(); }}
        />,
      );
    }

    body = (
      <>
        <Legend items={cfg.series.map((x) => ({ name: x.name, fill: x.fill }))} />
        <svg width={W} height={H}>
          {els}
          <XLabels n={n} pw={pw} X={(i) => m.l + bw * i + bw / 2} labels={cfg.labels} H={H} minW={cfg.labelW || 30} />
        </svg>
      </>
    );
  }
  return <div ref={ref}>{body}</div>;
}

// ---------------------------------------------------------------- zamonaviy silliq chiziqli grafik (krossxeyr + maqsad chizig'i + jonli nuqta)
export type LineSeries = { name: string; fill: string; values: (number | null)[]; area?: boolean; dots?: boolean; w?: number };
export function Lines(cfg: {
  labels: string[];
  tips?: string[];
  series: LineSeries[];
  fmt: (v: number) => string;
  fmtAxis?: (v: number) => string;
  h?: number;
  labelW?: number;
  zero?: boolean;
  max?: number;
  target?: { value: number; label?: string };
}) {
  const [ref, cw] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const [hov, setHov] = useState<number | null>(null);
  const W = Math.max(260, cw || 600), H = cfg.h || 220, m = { l: 48, r: 14, t: 12, b: 22 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b, n = cfg.labels.length;
  const vals: number[] = [];
  cfg.series.forEach((se) => se.values.forEach((v) => { if (v != null && isFinite(v)) vals.push(v); }));
  if (cfg.target) vals.push(cfg.target.value);

  let body: ReactNode;
  if (!vals.length) body = <None />;
  else {
    let mn = vals.reduce((a, b) => (b < a ? b : a), Infinity), mx = vals.reduce((a, b) => (b > a ? b : a), -Infinity);
    if (cfg.zero !== false) mn = Math.min(0, mn);
    else {
      const pad = (mx - mn) * 0.16 || 1;
      mn -= pad; mx += pad;
      if (cfg.max != null) mx = Math.min(mx, cfg.max);
    }
    const t = nice(mn, mx, 4), fa = cfg.fmtAxis || C;
    const X = (i: number) => m.l + (n <= 1 ? pw / 2 : (i * pw) / (n - 1));
    const Y = (v: number) => m.t + ph - ((v - t.lo) / (t.hi - t.lo)) * ph;
    const els: ReactNode[] = [];
    t.ticks.forEach((v) => {
      els.push(<line key={"g" + v} className="g-grid" x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} />);
      els.push(<text key={"t" + v} x={m.l - 8} y={Y(v) + 4} textAnchor="end">{fa(v)}</text>);
    });

    if (cfg.target && cfg.target.value >= t.lo && cfg.target.value <= t.hi) {
      const ty = Y(cfg.target.value);
      els.push(
        <g key="target">
          <line x1={m.l} x2={W - m.r} y1={ty} y2={ty} stroke="var(--v-teal-mid)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.7" />
          {cfg.target.label ? (
            <text x={W - m.r - 2} y={ty - 5} textAnchor="end" style={{ fontSize: 10, fontWeight: 650, fill: "var(--v-teal-mid)" }}>{cfg.target.label}</text>
          ) : null}
        </g>,
      );
    }

    cfg.series.forEach((se, si) => {
      const segs: [number, number][][] = [];
      let cur: [number, number][] = [];
      se.values.forEach((v, i) => {
        if (v == null || !isFinite(v)) { if (cur.length) segs.push(cur); cur = []; } else cur.push([X(i), Y(v)]);
      });
      if (cur.length) segs.push(cur);
      const stroke = FILL[se.fill]?.line || "#3b82f6";
      segs.forEach((pts, pi) => {
        let d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
        for (let j = 1; j < pts.length; j++) {
          const mxp = (pts[j - 1][0] + pts[j][0]) / 2;
          d += "C" + mxp.toFixed(1) + "," + pts[j - 1][1].toFixed(1) + " " + mxp.toFixed(1) + "," + pts[j][1].toFixed(1) + " " + pts[j][0].toFixed(1) + "," + pts[j][1].toFixed(1);
        }
        if (se.area) els.push(<path key={`a${si}-${pi}`} d={`${d} L${pts[pts.length - 1][0].toFixed(1)},${m.t + ph} L${pts[0][0].toFixed(1)},${m.t + ph} Z`} fill="url(#gArea)" />);
        els.push(<path key={`l${si}-${pi}`} d={d} fill="none" stroke={stroke} strokeWidth={se.w || 2.4} strokeLinecap="round" />);
        if (se.dots) {
          pts.forEach((p, k) => els.push(<circle key={`d${si}-${pi}-${k}`} cx={+p[0].toFixed(1)} cy={+p[1].toFixed(1)} r={3.5} fill="var(--v-card-solid)" stroke={stroke} strokeWidth={2} />));
        } else if (pi === segs.length - 1 && pts.length > 1) {
          const last = pts[pts.length - 1];
          els.push(<circle key={`end${si}`} cx={+last[0].toFixed(1)} cy={+last[1].toFixed(1)} r={3.2} fill={stroke} />);
        }
      });
    });

    body = (
      <>
        <Legend items={cfg.series.map((x) => ({ name: x.name, fill: x.fill, line: true }))} />
        <svg width={W} height={H}>
          {els}
          <XLabels n={n} pw={pw} X={X} labels={cfg.labels} H={H} minW={cfg.labelW} />
          {hov != null ? (
            <g>
              <line x1={X(hov)} x2={X(hov)} y1={m.t} y2={m.t + ph} stroke="var(--v-line-hi)" strokeDasharray="3 3" />
              {cfg.series.map((se, k) => {
                const v = se.values[hov];
                const stroke = FILL[se.fill]?.line || "#3b82f6";
                return v == null || !isFinite(v) ? null : (
                  <g key={k}>
                    <circle cx={X(hov)} cy={Y(v)} r={6} fill={stroke} opacity={0.18} />
                    <circle cx={X(hov)} cy={Y(v)} r={4} fill="var(--v-card-solid)" stroke={stroke} strokeWidth={2.2} />
                  </g>
                );
              })}
            </g>
          ) : null}
          <rect
            className="g-ov"
            x={m.l}
            y={m.t}
            width={pw}
            height={ph}
            onMouseMove={(e) => {
              const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - r.left) * W) / r.width;
              let i = n <= 1 ? 0 : Math.round((px - m.l) / (pw / (n - 1)));
              i = Math.max(0, Math.min(n - 1, i));
              setHov(i);
              tip.show(
                <>
                  <div className="h">{cfg.tips ? cfg.tips[i] : cfg.labels[i]}</div>
                  {cfg.series.map((se) => (
                    <TipRow key={se.name} sw={FILL[se.fill]?.sw} name={se.name} val={se.values[i] == null ? "—" : cfg.fmt(se.values[i] as number)} />
                  ))}
                </>,
                e,
              );
            }}
            onMouseLeave={() => { setHov(null); tip.hide(); }}
          />
        </svg>
      </>
    );
  }
  return <div ref={ref}>{body}</div>;
}

// ---------------------------------------------------------------- zamonaviy reyting (minimalist aniq satr + chiziq)
export type RankItem = { code: string; sub?: string; value: number; extra?: ReactNode; [k: string]: any };
export function Rank({ items, short, tone, fmt, tip }: { items: RankItem[]; short?: boolean; tone?: string; fmt?: (v: number) => string; tip?: (it: RankItem) => ReactNode }) {
  const t = useTip();
  if (!items.length) return <None />;
  const mx = Math.max(...items.map((x) => x.value)) || 1;
  return (
    <ul className="vg__rank">
      {items.map((it, i) => (
        <li key={i} className={short ? "short" : ""} onMouseMove={tip ? (e) => t.show(tip(it), e) : undefined} onMouseLeave={tip ? t.hide : undefined}>
          <span className="vg__rank-code" title={it.code + (it.sub ? " " + it.sub : "")}>
            {it.code}
            {it.sub ? <small>{it.sub}</small> : null}
          </span>
          <span className={`vg__rank-bar ${tone || ""}`}>
            <i style={{ width: Math.max(3, (it.value / mx) * 100) + "%" }} />
          </span>
          <b>
            {(fmt || N)(it.value)}
            {it.extra ? <small>{it.extra}</small> : null}
          </b>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- zamonaviy segmentli halqa (bo'laklar orasida bo'shliq + interaktiv hover)
export function Donut({ parts, total, caption, vertical, showPct }: { parts: { label: string; value: number; color: string }[]; total: number; caption: string; vertical?: boolean; showPct?: boolean }) {
  const [hot, setHot] = useState<string | null>(null);
  const R = 52, Cc = 2 * Math.PI * R;
  const nonzero = parts.filter((p) => p.value > 0);
  const gap = nonzero.length > 1 ? 6 : 0;
  let acc = 0;
  const active = hot ? parts.find((p) => p.label === hot) : null;

  return (
    <div className={"vg__donut" + (vertical ? " vg__donut--vert" : "")}>
      <svg viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--v-track)" strokeWidth="12" />
        {total > 0
          ? parts.map((p) => {
              const rawLen = (p.value / total) * Cc;
              const off = acc;
              acc += rawLen;
              const len = Math.max(0, rawLen - gap);
              const isHot = hot === p.label;
              const dim = hot && !isHot ? 0.3 : 1;
              return len > 0 ? (
                <circle
                  key={p.label}
                  cx="70" cy="70" r={R} fill="none" stroke={p.color}
                  strokeWidth={isHot ? "15" : "12"}
                  strokeLinecap="round"
                  strokeDasharray={`${len.toFixed(2)} ${(Cc - len).toFixed(2)}`}
                  strokeDashoffset={(-off - gap / 2).toFixed(2)}
                  transform="rotate(-90 70 70)"
                  opacity={dim}
                  style={{ cursor: "pointer", transition: "opacity 0.16s ease, stroke-width 0.16s ease" }}
                  onMouseEnter={() => setHot(p.label)}
                  onMouseLeave={() => setHot(null)}
                >
                  <title>{p.label + ": " + p.value}</title>
                </circle>
              ) : null;
            })
          : null}
        <text x="70" y="69" textAnchor="middle" className="vg__donut-total">
          {active ? N(active.value) : N(total)}
        </text>
        <text x="70" y="86" textAnchor="middle" className="vg__donut-cap">
          {active ? (total ? Math.round((active.value / total) * 100) + "% · " + active.label : active.label) : caption}
        </text>
      </svg>
      <ul className="vg__dleg">
        {parts.map((p) => (
          <li
            key={p.label}
            className={hot === p.label ? "on" : undefined}
            onMouseEnter={() => setHot(p.label)}
            onMouseLeave={() => setHot(null)}
          >
            <i style={{ background: p.color }} />
            <span>{p.label}</span>
            <b>
              {N(p.value)}
              {showPct && total ? <small> · {Math.round((p.value / total) * 100)}%</small> : null}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- jadval
export type Col<R = any> = { h: string; n?: boolean; f: (r: R) => ReactNode };
export function DataTable<R = any>({ rows, cols, scroll, tall, foot, sel }: { rows: R[]; cols: Col<R>[]; scroll?: boolean; tall?: boolean; foot?: R; sel?: (r: R) => boolean }) {
  return (
    <div className={"tw" + (scroll ? " tscroll" + (tall ? " tall" : "") : "")}>
      <table className="vg__table">
        <thead>
          <tr>{cols.map((c, i) => <th key={i} className={c.n ? "n" : ""}>{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={sel && sel(r) ? "sel" : undefined}>
              {cols.map((c, ci) => <td key={ci} className={c.n ? "n" : ""}>{c.f(r)}</td>)}
            </tr>
          ))}
        </tbody>
        {foot ? (
          <tfoot>
            <tr>{cols.map((c, ci) => <td key={ci} className={c.n ? "n" : ""}>{c.f(foot)}</td>)}</tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- karta, qator, tab, stat
export function Card({ title, hint, chart, table, tools, cls, children }: { title: ReactNode; hint?: ReactNode; chart?: ReactNode; table?: ReactNode; tools?: ReactNode; cls?: string; children?: ReactNode }) {
  const [showT, setShowT] = useState(false);
  const both = chart != null && table != null;
  return (
    <section className={"vg__card" + (cls ? " " + cls : "")}>
      <header className="vg__card-head">
        <div>
          <h2 className="vg__title">{title}</h2>
          {hint ? <p className="vg__hint">{hint}</p> : null}
        </div>
        <div className="vg__tools">
          {tools}
          {both ? (
            <button type="button" className="vg__btn" onClick={() => setShowT(!showT)}>
              {showT ? "Grafik" : "Jadval"}
            </button>
          ) : null}
        </div>
      </header>
      <div className="bd">{children ?? (both ? (showT ? table : chart) : (chart ?? table))}</div>
    </section>
  );
}

export const Row = ({ cls, children }: { cls: string; children: ReactNode }) => <div className={"vg__row " + cls}>{children}</div>;

export function Tabs<V extends string>({ options, val, onPick }: { options: [V, string][]; val: V; onPick: (v: V) => void }) {
  return (
    <div className="vg__tabs">
      {options.map((o) => (
        <button key={o[0]} type="button" className={o[0] === val ? "on" : ""} onClick={() => onPick(o[0])}>
          {o[1]}
        </button>
      ))}
    </div>
  );
}

export type StatItem = { l: string; v: ReactNode; u?: string; r?: ReactNode; s?: ReactNode; cls?: string; spark?: number[]; sparkColor?: string };
export function Stats({ list }: { list: StatItem[] }) {
  return (
    <div className="vg__stats">
      {list.map((k, i) => (
        <div className={"vg__stat" + (k.cls ? " " + k.cls : "")} key={i}>
          <div className="vg__stat-head">
            <div className="vg__stat-l">{k.l}</div>
            {k.r ? <div className="vg__stat-r">{k.r}</div> : null}
          </div>
          <div className="vg__stat-main">
            <div>
              <div className="vg__stat-v">
                {k.v}
                {k.u ? <small>{k.u}</small> : null}
              </div>
              {k.s ? <div className="vg__stat-s">{k.s}</div> : null}
            </div>
            {k.spark && k.spark.length > 1 ? <Sparkline values={k.spark} color={k.sparkColor || "#3b82f6"} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
