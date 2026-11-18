/* eslint-disable @typescript-eslint/no-explicit-any */
export const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const nf1v = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

type Num = number | null | undefined;
const bad = (v: Num) => v == null || !isFinite(v as number);

export const N = (v: Num) => (bad(v) ? "—" : nf.format(Math.round(v as number)));
export const N1 = (v: Num) => (bad(v) ? "—" : nf1.format(v as number));
export const P = (v: Num) => (bad(v) ? "—" : nf1.format((v as number) * 100) + "%");
export function C(v: number) {
  const a = Math.abs(v);
  if (a >= 1e6) return nf1.format(v / 1e6).replace(/,0$/, "") + " mln";
  if (a >= 1e4) return nf.format(v / 1e3) + " ming";
  if (a >= 1e3) return nf1.format(v / 1e3).replace(/,0$/, "") + " ming";
  return nf.format(v);
}
export const T = (kg: number) => kg / 1000;

export function sum(rows: any[], f: string | ((r: any) => number)): number {
  let s = 0;
  for (let i = 0; i < rows.length; i++) {
    const v = typeof f === "function" ? f(rows[i]) : rows[i][f];
    s += +v || 0;
  }
  return s;
}

export function iso(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function nice(min: number, max: number, count: number) {
  if (min === max) max = min + 1;
  const span = max - min;
  let step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step;
  if (err >= 7.5) step *= 10;
  else if (err >= 3.5) step *= 5;
  else if (err >= 1.5) step *= 2;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, ticks };
}
