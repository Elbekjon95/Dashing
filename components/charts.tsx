/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { C, N, nice } from "@/lib/format";
import { TipRow, useTip } from "@/lib/dash";

export const FILL: Record<string, { g: string; sw: string; line: string }> = {
  teal: { g: "url(#gTeal)", sw: "linear-gradient(#3fb8a5,#0f766e)", line: "#2a9d8f" },
  orange: { g: "url(#gOrange)", sw: "linear-gradient(#ffd5a8,#f08a3c)", line: "#f08a3c" },
  mint: { g: "url(#gMint)", sw: "linear-gradient(#cfeee6,#8ad4c4)", line: "#8ad4c4" },
  grey: { g: "url(#gGrey)", sw: "linear-gradient(#e3ebea,#b7c4c2)", line: "#9fb0ae" },
  red: { g: "url(#gRed)", sw: "linear-gradient(#f3a6a3,#d9534f)", line: "#d9534f" },
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
          <i className={s.line ? "ln" : ""} style={{ background: FILL[s.fill].sw }} />
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

// ---------------------------------------------------------------- ustunli grafik
export type BarSeries = { name: string; fill: string; values: (number | null)[]; faint?: boolean[] };
export function Bars(cfg: { labels: string[]; tips?: string[]; series: BarSeries[]; fmt: (v: number) => string; fmtAxis?: (v: number) => string; h?: number; labelW?: number; stack?: boolean; note?: (i: number) => string }) {
  const [ref, cw] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const W = Math.max(260, cw || 600), H = cfg.h || 230, m = { l: 48, r: 8, t: 8, b: 22 };
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
        <text key={"t" + v} x={m.l - 6} y={Y(v) + 4} textAnchor="end">
          {fa(v)}
        </text>,
      );
    });
    for (let i = 0; i < n; i++) {
      const x0 = m.l + bw * i;
      if (cfg.stack) {
        const w = Math.max(2, Math.min(34, bw * 0.62));
        let base = 0;
        const segs: { v: number; f: string }[] = [];
        cfg.series.forEach((se) => {
          const v = +(se.values[i] as number) || 0;
          if (v > 0) segs.push({ v, f: se.fill });
        });
        segs.forEach((sg, k) => {
          const y0 = Y(base), y1 = Y(base + sg.v), gap = k > 0 ? 2 : 0, h = Math.max(0, y0 - y1 - gap);
          if (h > 0) els.push(<rect key={`s${i}-${k}`} x={x0 + (bw - w) / 2} y={y0 - gap - h} width={w} height={h} rx={k === segs.length - 1 ? Math.min(3, h / 2) : 0} fill={FILL[sg.f].g} />);
          base += sg.v;
        });
      } else {
        const inner = Math.min(bw * 0.8, ns * 26), bwi = Math.max(1.5, inner / ns - 2), start = x0 + (bw - inner) / 2;
        cfg.series.forEach((se, k) => {
          const v = +(se.values[i] as number) || 0;
          if (v <= 0) return;
          els.push(<rect key={`b${i}-${k}`} x={start + k * (bwi + 2)} y={Y(v)} width={bwi} height={m.t + ph - Y(v)} rx={Math.min(3, bwi / 2)} fill={FILL[se.fill].g} opacity={se.faint && se.faint[i] ? 0.45 : undefined} />);
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
            const note = cfg.note && cfg.note(i);
            tip.show(
              <>
                <div className="h">{cfg.tips ? cfg.tips[i] : cfg.labels[i]}</div>
                {cfg.series.map((se) => (
                  <TipRow key={se.name} sw={FILL[se.fill].sw} name={se.name} val={cfg.fmt(+(se.values[i] as number) || 0)} />
                ))}
                {cfg.stack && ns > 1 ? <TipRow name="Jami" val={cfg.fmt(tot[i])} /> : null}
                {note ? <div style={{ color: "#8aa09e", marginTop: 4 }}>{note}</div> : null}
              </>,
              e,
            );
          }}
          onMouseLeave={tip.hide}
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

// ---------------------------------------------------------------- chiziqli grafik
export type LineSeries = { name: string; fill: string; values: (number | null)[]; area?: boolean; dots?: boolean; w?: number };
export function Lines(cfg: { labels: string[]; tips?: string[]; series: LineSeries[]; fmt: (v: number) => string; fmtAxis?: (v: number) => string; h?: number; labelW?: number; zero?: boolean; max?: number }) {
  const [ref, cw] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const [hov, setHov] = useState<number | null>(null);
  const W = Math.max(260, cw || 600), H = cfg.h || 220, m = { l: 48, r: 12, t: 12, b: 22 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b, n = cfg.labels.length;
  const vals: number[] = [];
  cfg.series.forEach((se) => se.values.forEach((v) => { if (v != null && isFinite(v)) vals.push(v); }));
  let body: ReactNode;
  if (!vals.length) body = <None />;
  else {
    let mn = vals.reduce((a, b) => (b < a ? b : a), Infinity), mx = vals.reduce((a, b) => (b > a ? b : a), -Infinity);
    if (cfg.zero !== false) mn = Math.min(0, mn);
    else {
      const pad = (mx - mn) * 0.15 || 1;
      mn -= pad; mx += pad;
      if (cfg.max != null) mx = Math.min(mx, cfg.max);
    }
    const t = nice(mn, mx, 4), fa = cfg.fmtAxis || C;
    const X = (i: number) => m.l + (n <= 1 ? pw / 2 : (i * pw) / (n - 1));
    const Y = (v: number) => m.t + ph - ((v - t.lo) / (t.hi - t.lo)) * ph;
    const els: ReactNode[] = [];
    t.ticks.forEach((v) => {
      els.push(<line key={"g" + v} className="g-grid" x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} />);
      els.push(<text key={"t" + v} x={m.l - 6} y={Y(v) + 4} textAnchor="end">{fa(v)}</text>);
    });
    cfg.series.forEach((se, si) => {
      const segs: [number, number][][] = [];
      let cur: [number, number][] = [];
      se.values.forEach((v, i) => {
        if (v == null || !isFinite(v)) { if (cur.length) segs.push(cur); cur = []; } else cur.push([X(i), Y(v)]);
      });
      if (cur.length) segs.push(cur);
      segs.forEach((pts, pi) => {
        let d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
        for (let j = 1; j < pts.length; j++) {
          const mxp = (pts[j - 1][0] + pts[j][0]) / 2;
          d += "C" + mxp.toFixed(1) + "," + pts[j - 1][1].toFixed(1) + " " + mxp.toFixed(1) + "," + pts[j][1].toFixed(1) + " " + pts[j][0].toFixed(1) + "," + pts[j][1].toFixed(1);
        }
        if (se.area) els.push(<path key={`a${si}-${pi}`} d={`${d} L${pts[pts.length - 1][0].toFixed(1)},${m.t + ph} L${pts[0][0].toFixed(1)},${m.t + ph} Z`} fill="url(#gArea)" />);
        els.push(<path key={`l${si}-${pi}`} d={d} fill="none" stroke={FILL[se.fill].line} strokeWidth={se.w || 2.8} strokeLinecap="round" />);
        if (se.dots) pts.forEach((p, k) => els.push(<circle key={`d${si}-${pi}-${k}`} cx={+p[0].toFixed(1)} cy={+p[1].toFixed(1)} r={4} fill="#fff" stroke={FILL[se.fill].line} strokeWidth={2.2} />));
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
              <line x1={X(hov)} x2={X(hov)} y1={m.t} y2={m.t + ph} stroke="rgba(15,80,72,.25)" />
              {cfg.series.map((se, k) => {
                const v = se.values[hov];
                return v == null || !isFinite(v) ? null : <circle key={k} cx={X(hov)} cy={Y(v)} r={5} fill="#fff" stroke={FILL[se.fill].line} strokeWidth={2.4} />;
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
                    <TipRow key={se.name} sw={FILL[se.fill].sw} name={se.name} val={se.values[i] == null ? "—" : cfg.fmt(se.values[i] as number)} />
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

// ---------------------------------------------------------------- reyting (gorizontal)
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

// ---------------------------------------------------------------- donut
export function Donut({ parts, total, caption }: { parts: { label: string; value: number; color: string }[]; total: number; caption: string }) {
  const R = 52, Cc = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="vg__donut">
      <svg viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(15,118,110,0.1)" strokeWidth="16" />
        {total > 0
          ? parts.map((p) => {
              const len = (p.value / total) * Cc;
              const off = acc;
              acc += len;
              return len > 0 ? (
                <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="16" strokeDasharray={`${len.toFixed(2)} ${(Cc - len).toFixed(2)}`} strokeDashoffset={(-off).toFixed(2)} transform="rotate(-90 70 70)">
                  <title>{p.label + ": " + p.value}</title>
                </circle>
              ) : null;
            })
          : null}
        <text x="70" y="70" textAnchor="middle" className="vg__donut-total">{N(total)}</text>
        <text x="70" y="88" textAnchor="middle">{caption}</text>
      </svg>
      <ul className="vg__dleg">
        {parts.map((p) => (
          <li key={p.label}>
            <i style={{ background: p.color }} />
            {p.label}
            <b>{N(p.value)}</b>
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

export type StatItem = { l: string; v: ReactNode; u?: string; r?: ReactNode; s?: ReactNode };
export function Stats({ list }: { list: StatItem[] }) {
  return (
    <div className="vg__stats">
      {list.map((k, i) => (
        <div className="vg__stat" key={i}>
          <div className="vg__stat-l">{k.l}</div>
          <div className="vg__stat-v">
            {k.v}
            {k.u ? <small>{k.u}</small> : null}
          </div>
          {k.r ? <div className="vg__stat-r">{k.r}</div> : null}
          {k.s ? <div className="vg__stat-s">{k.s}</div> : null}
        </div>
      ))}
    </div>
  );
}
