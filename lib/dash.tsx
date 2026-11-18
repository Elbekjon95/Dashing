/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { createContext, useContext, useMemo, type ReactNode, type MouseEvent } from "react";
import { AP_NAME, DK } from "./static";
import { nf1v } from "./format";

// ---------------------------------------------------------------- holat (S)
export type DashState = {
  tab: string;
  ap: string;
  davr: "d30" | "ytd";
  metr: "baj" | "pax" | "yuk";
  tTur: string;
  tHolat: string;
  tQ: string;
};
export const DEFAULT_STATE: DashState = { tab: "bugun", ap: "ALL", davr: "d30", metr: "baj", tTur: "all", tHolat: "all", tQ: "" };

export type DashData = any;

type Ctx = { D: DashData; S: DashState; set: (p: Partial<DashState>) => void; kiosk: boolean };
export const DashCtx = createContext<Ctx>(null as unknown as Ctx);
export const useDash = () => useContext(DashCtx);

// ---------------------------------------------------------------- tooltip
type TipApi = { show: (content: ReactNode, e: MouseEvent | { clientX: number; clientY: number }) => void; hide: () => void };
export const TipCtx = createContext<TipApi>({ show: () => {}, hide: () => {} });
export const useTip = () => useContext(TipCtx);
export function TipRow({ sw, name, val }: { sw?: string; name: string; val: ReactNode }) {
  return (
    <div className="r">
      <span>
        {sw ? <i style={{ background: sw }} /> : null}
        {name}
      </span>
      <span>{val}</span>
    </div>
  );
}

// ---------------------------------------------------------------- lugʻat yordamchilari
export function useLookups() {
  const { D } = useDash();
  return useMemo(() => {
    const lg = D?.lugat || {};
    const apLabel = (c: string) => AP_NAME[c] || c;
    const akName = (c: string) => (lg.ak && lg.ak[c]) || c;
    const placeName = (c: string) => {
      if (AP_NAME[c]) return AP_NAME[c];
      const a = lg.ap && lg.ap[c];
      return a ? a.e || a.n || c : c;
    };
    const country = (c: string) => {
      if (AP_NAME[c]) return "Oʻzbekiston";
      const a = lg.ap && lg.ap[c];
      return a && a.c ? a.c : "Nomaʼlum";
    };
    const dDesc = (k: string) => {
      if (!k || k === "-") return "Kod koʻrsatilmagan";
      const m = String(k).match(/^(\d{2})/);
      const ks = lg.ks || {};
      if (ks[k]) return ks[k];
      if (m && DK[m[1]]) return DK[m[1]];
      if (m && ks[m[1]]) return ks[m[1]];
      return "";
    };
    return { apLabel, akName, placeName, country, dDesc };
  }, [D]);
}

export function dGroup(k: string) {
  const n = parseInt(k, 10);
  if (isNaN(n)) return "Kodsiz / nomaʼlum";
  if (n < 10) return "Aviakompaniya ichki";
  if (n < 20) return "Yoʻlovchi va bagaj";
  if (n < 30) return "Yuk va pochta";
  if (n < 40) return "Yerdagi xizmat";
  if (n < 50) return "Texnik sabablar";
  if (n < 60) return "Shikast / IT tizimlar";
  if (n < 70) return "Ekipaj va parvoz operatsiyasi";
  if (n < 80) return "Ob-havo";
  if (n < 90) return "Havo harakati va aeroport";
  if (n < 97) return "Aylanma (oldingi reys)";
  return "Boshqa";
}

export function useSelAp() {
  const { S } = useDash();
  return (rows: any[]) => (S.ap === "ALL" ? rows : rows.filter((r) => r.ap === S.ap));
}

export function davrNom(davr: string) {
  return davr === "d30" ? "oxirgi 30 kun" : "yil boshidan kechagacha";
}
export function todayStr(D: DashData) {
  if (D?.kecha?.bugun) return String(D.kecha.bugun); // bazadagi joriy UTC sana (Grafana "Today UTC" bilan bir xil)
  if (D?.meta?.yaratildi) return String(D.meta.yaratildi).slice(0, 10);
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// ---------------------------------------------------------------- kichik komponentlar
export function Delta({ cur, prev, big, bad, pp }: { cur: number | null | undefined; prev: number | null | undefined; big?: boolean; bad?: boolean; pp?: boolean }) {
  const b = big ? " big" : "";
  if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev)) return null;
  if (pp) {
    const dp = Math.round((cur - prev) * 10) / 10;
    return (
      <span className={`vg__delta vg__delta--${dp > 0 ? "up" : dp < 0 ? "down" : "same"}${b}`}>
        {dp > 0 ? "↗ +" : dp < 0 ? "↘ −" : "— "}
        {nf1v.format(Math.abs(dp))} p.p.
      </span>
    );
  }
  if (prev === 0) return cur > 0 ? <span className={`vg__delta vg__delta--new${b}`}>yangi</span> : <span className={`vg__delta vg__delta--same${b}`}>— 0%</span>;
  const pc = Math.round(((cur - prev) / prev) * 1000) / 10;
  let kind = pc > 0 ? "up" : pc < 0 ? "down" : "same";
  if (bad && kind !== "same") kind = kind === "up" ? "down" : "up";
  return (
    <span className={`vg__delta vg__delta--${kind}${b}`}>
      {pc > 0 ? "↗ +" : pc < 0 ? "↘ −" : "— "}
      {nf1v.format(Math.abs(pc))}%
    </span>
  );
}

export function StatusPill({ h }: { h: string }) {
  const m: Record<string, [string, string]> = { bajarildi: ["baj", "Bajarildi"], kechikmoqda: ["kech", "Kechikmoqda"], bekor: ["bek", "Bekor qilindi"], kutilmoqda: ["", "Reja boʻyicha"] };
  const x = m[h] || ["", h];
  return <span className={`vg__st ${x[0]}`}>{x[1]}</span>;
}

const ico = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const PlaneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...ico}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
);
export const ChevL = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...ico} strokeWidth={2.2}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);
export const ChevR = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...ico} strokeWidth={2.2}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);
export const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4v16l13-8z" />
  </svg>
);
export const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);
