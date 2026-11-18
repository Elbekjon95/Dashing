// Uch tilli interfeys (oʻzbek / rus / ingliz).
// Matnlar manba kodida oʻzbekcha yoziladi; tanlangan til ruscha yoki inglizcha boʻlsa, sahifadagi matnlar
// lugʻat (i18n-dict.ts) boʻyicha brauzerda tarjima qilinadi: raqamlar bilan birikkan dinamik matnlar ham boʻlak-boʻlak.
import { DICT } from "./i18n-dict";

export type Lang = "uz" | "ru" | "en";
export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "uz", label: "UZ", name: "Oʻzbekcha" },
  { id: "ru", label: "RU", name: "Русский" },
  { id: "en", label: "EN", name: "English" },
];
export const LANG_KEY = "dash.lang";
export const LANG_EVENT = "dash-lang";

export function currentLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "uz" || v === "ru" || v === "en") return v;
    const n = (navigator.language || "").toLowerCase();
    if (n.startsWith("ru")) return "ru";
    if (n.startsWith("en")) return "en";
  } catch {}
  return "uz";
}

export function setLang(l: Lang) {
  try { localStorage.setItem(LANG_KEY, l); } catch {}
  try { window.dispatchEvent(new Event(LANG_EVENT)); } catch {}
}

// ---------------------------------------------------------------- tarjima mexanizmi
const APOS = /[ʻʼ‘’`´]/g; // ʻ ʼ ‘ ’ ` ´  -> '
const norm = (s: string) => s.replace(APOS, "'");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const MONTH_GEN: Record<"ru" | "en", string[]> = {
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

type Engine = { re: RegExp; map: Map<string, string> };
const engines: Partial<Record<Lang, Engine>> = {};

function engine(lang: "ru" | "en"): Engine {
  const hit = engines[lang];
  if (hit) return hit;
  const map = new Map<string, string>();
  for (const e of DICT) {
    const k = norm(e[0]).toLowerCase();
    if (!map.has(k)) map.set(k, lang === "ru" ? e[1] : e[2]); // birinchi yozuv ustun
  }
  const keys = Array.from(map.keys()).sort((a, b) => b.length - a.length);
  const bL = "(?<![\\p{L}\\p{N}'])", bR = "(?![\\p{L}\\p{N}'])";
  const date = `\\d{1,2} (?:${MONTHS.join("|")})`;
  const re = new RegExp(`${bL}(?:${date}|${keys.map(esc).join("|")})${bR}`, "giu");
  return (engines[lang] = { re, map });
}

// manba (kichik/katta harf) boʻyicha birinchi harf registrini moslaymiz; qisqartmalar (UTC, BAA…) oʻzgarmaydi
function fixCase(src: string, tr: string) {
  const c = src.charAt(0), t0 = tr.charAt(0);
  if (!tr) return tr;
  const isUpperSrc = c !== c.toLowerCase();
  const second = tr.charAt(1);
  const acronym = second !== "" && second === second.toUpperCase() && second !== second.toLowerCase();
  if (acronym) return tr;
  return (isUpperSrc ? t0.toUpperCase() : t0.toLowerCase()) + tr.slice(1);
}

export function translate(text: string, lang: Lang): string {
  if (lang === "uz" || !text) return text;
  const n = norm(text);
  if (!/[A-Za-z]/.test(n)) return text;
  const { re, map } = engine(lang);
  re.lastIndex = 0;
  let out = "", last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(n))) {
    const src = text.slice(m.index, m.index + m[0].length);
    let rep: string;
    const dm = /^(\d{1,2}) (\w+)$/.exec(n.slice(m.index, m.index + m[0].length).toLowerCase());
    if (dm && MONTHS.includes(dm[2])) {
      const mi = MONTHS.indexOf(dm[2]);
      rep = lang === "ru" ? `${dm[1]} ${MONTH_GEN.ru[mi]}` : `${dm[1]} ${MONTH_GEN.en[mi]}`;
    } else {
      const v = map.get(m[0].toLowerCase());
      rep = v === undefined ? src : fixCase(src, v);
    }
    out += text.slice(last, m.index) + rep;
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  return last === 0 ? text : out + text.slice(last);
}

// ---------------------------------------------------------------- DOM tarjimoni
type Rec = { o: string; t: string };
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "CODE"]);
const ATTRS = ["title", "aria-label", "placeholder", "alt"];

export class DomTranslator {
  private lang: Lang = "uz";
  private texts = new WeakMap<Text, Rec>();
  private attrs = new WeakMap<Element, Record<string, Rec>>();
  private obs: MutationObserver | null = null;

  start(lang: Lang) {
    this.lang = lang;
    this.stop(false);
    if (typeof document === "undefined") return;
    this.walk(document.body);
    if (lang === "uz") return;
    this.obs = new MutationObserver((list) => {
      for (const r of list) {
        if (r.type === "characterData") this.text(r.target as Text);
        else if (r.type === "attributes") this.attr(r.target as Element, r.attributeName || "");
        else r.addedNodes.forEach((n) => this.walk(n));
      }
    });
    this.obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.documentElement.lang = lang;
  }

  stop(restore = true) {
    this.obs?.disconnect();
    this.obs = null;
    if (restore && typeof document !== "undefined") { this.lang = "uz"; this.walk(document.body); document.documentElement.lang = "uz"; }
  }

  private text(node: Text) {
    const p = node.parentElement;
    if (p && SKIP.has(p.tagName)) return;
    const cur = node.nodeValue || "";
    const rec = this.texts.get(node);
    const orig = rec && rec.t === cur ? rec.o : cur; // oʻzimiz yozgan boʻlsa — asl matn; React yangi matn yozgan boʻlsa — yangisi
    const out = translate(orig, this.lang);
    this.texts.set(node, { o: orig, t: out });
    if (out !== cur) node.nodeValue = out;
  }

  private attr(el: Element, name: string) {
    if (!ATTRS.includes(name)) return;
    const cur = el.getAttribute(name);
    if (cur == null) return;
    const all = this.attrs.get(el) || {};
    const rec = all[name];
    const orig = rec && rec.t === cur ? rec.o : cur;
    const out = translate(orig, this.lang);
    all[name] = { o: orig, t: out };
    this.attrs.set(el, all);
    if (out !== cur) el.setAttribute(name, out);
  }

  private walk(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) { this.text(root as Text); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const el = root as Element;
    if (SKIP.has(el.tagName)) return;
    ATTRS.forEach((a) => { if (el.hasAttribute(a)) this.attr(el, a); });
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n: Node | null = tw.nextNode();
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) this.text(n as Text);
      else ATTRS.forEach((a) => { if ((n as Element).hasAttribute(a)) this.attr(n as Element, a); });
      n = tw.nextNode();
    }
  }
}
