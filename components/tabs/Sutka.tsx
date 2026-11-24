/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, type ReactNode } from "react";
import { N, N1, T } from "@/lib/format";
import { useDash, useLookups } from "@/lib/dash";
import { Card, Donut, ProportionalBar } from "../charts";
import { ICONS } from "../UzMap";

// Bazadagi davlat nomlari rus tilida — oʻzbekchaga oʻgiramiz (topilmasa, asl nomi koʻrsatiladi)
const COUNTRY_UZ: Record<string, string> = {
  "Российская Федерация (Россия)": "Rossiya", "Саудовская Аравия": "Saudiya Arabistoni", "Китай": "Xitoy", "Турция": "Turkiya",
  "Объединенные Арабские Эмираты": "BAA", "Республика Казахстан": "Qozogʻiston", "Кыргызская Республика": "Qirgʻiziston", "Израиль": "Isroil",
  "Корейская Республика": "Koreya", "Республика Таджикистан": "Tojikiston", "Вьетнам": "Vyetnam", "Таиланд": "Tailand", "Индия": "Hindiston",
  "Азербайджанская Республика": "Ozarbayjon", "Республика Азербайджан": "Ozarbayjon", "Египет": "Misr", "Малайзия": "Malayziya", "Германия": "Germaniya",
  "Великобритания": "Buyuk Britaniya", "Грузия": "Gruziya", "Республика Армения": "Armaniston", "Республика Беларусь": "Belarus", "Туркменистан": "Turkmaniston",
  "Иран": "Eron", "Исламская Республика Иран": "Eron", "Пакистан": "Pokiston", "Катар": "Qatar", "Кувейт": "Quvayt", "Оман": "Ummon", "Иордания": "Iordaniya",
  "Латвия": "Latviya", "Венгрия": "Vengriya", "Греция": "Gretsiya", "Индонезия": "Indoneziya", "Мальдивы": "Maldiv", "Япония": "Yaponiya", "Сингапур": "Singapur",
  "Украина": "Ukraina", "Афганистан": "Afgʻoniston", "Шри-Ланка": "Shri-Lanka", "Бангладеш": "Bangladesh", "Непал": "Nepal", "Франция": "Fransiya",
  "Италия": "Italiya", "Испания": "Ispaniya", "Польша": "Polsha", "Чехия": "Chexiya", "Болгария": "Bolgariya", "Сербия": "Serbiya", "Бахрейн": "Bahrayn", "Гонконг": "Gonkong", "Тайвань": "Tayvan", "Мальта": "Malta", "Кипр": "Kipr", "Литва": "Litva", "Эстония": "Estoniya", "Румыния": "Ruminiya", "Австрия": "Avstriya", "Швейцария": "Shveytsariya", "Нидерланды": "Niderlandiya", "Ливан": "Livan", "Ирак": "Iroq", "Республика Узбекистан": "Oʻzbekiston",
};
const cName = (k: string) => COUNTRY_UZ[k] || k;

type Side = { rej: number; bek: number; baj: number; kech: number; pax: number; pf: number; pc: number; py: number; ad: number; ch: number; inf: number; yuk: number; vvl: number; xal: number };
const ZERO: Side = { rej: 0, bek: 0, baj: 0, kech: 0, pax: 0, pf: 0, pc: 0, py: 0, ad: 0, ch: 0, inf: 0, yuk: 0, vvl: 0, xal: 0 };

type CellSpec = { val: ReactNode; pill?: string; warn?: boolean; bar?: number };
// bitta qatorda uch ustun: uchish | qoʻnish | jami (+ ixcham nisbat chizigʻi)
function Pair({ icon, label, dep, arr, total, tone }: { icon: string; label: string; dep: CellSpec; arr: CellSpec; total: ReactNode; tone?: "red" }) {
  const cls = "sut__num" + (tone ? " " + tone : "");
  return (
    <div className="sut__row sut__row--3">
      <span className="sut__lbl">{ICONS[icon]}{label}</span>
      <div className="sut__cell">
        <div className="sut__cell-top">
          <b className={cls}>{dep.val}</b>
          {dep.pill ? <span className={"sut__pill" + (dep.warn ? " warn" : "")}>{dep.pill}</span> : null}
        </div>
        {dep.bar != null ? <i className="sut__mbar"><u className={dep.warn ? "warn" : "dep"} style={{ width: Math.min(100, Math.max(0, dep.bar)) + "%" }} /></i> : null}
      </div>
      <div className="sut__cell">
        <div className="sut__cell-top">
          <b className={cls}>{arr.val}</b>
          {arr.pill ? <span className={"sut__pill" + (arr.warn ? " warn" : "")}>{arr.pill}</span> : null}
        </div>
        {arr.bar != null ? <i className="sut__mbar"><u className={arr.warn ? "warn" : "arr"} style={{ width: Math.min(100, Math.max(0, arr.bar)) + "%" }} /></i> : null}
      </div>
      <b className={"sut__tot" + (tone ? " " + tone : "")}>{total}</b>
    </div>
  );
}

export default function Sutka() {
  const { D } = useDash();
  // #sutka havolasi: maʼlumot kelgach shu boʻlimga oʻtadi
  useEffect(() => { if (typeof location !== "undefined" && /sutka/.test(location.hash)) document.getElementById("sutka")?.scrollIntoView(); }, []);
  const { akName, placeName } = useLookups();
  const s = D?.sutka;
  if (!s || !s.dep || !s.arr) return null;
  const U: Side = { ...ZERO, ...s.dep }, Q: Side = { ...ZERO, ...s.arr };
  // s.hozir — UTC; Toshkent vaqti = UTC+5 (yozgi/qishki vaqt yoʻq)
  const tas = (() => { const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(String(s.hozir || "")); return m ? String((+m[1] + 5) % 24).padStart(2, "0") + ":" + m[2] : ""; })();
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 + "%" : "—");
  const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const kgNode = (v: number) => (v >= 100000 ? <>{N(T(v))}<small>t</small></> : <>{N(v)}<small>kg</small></>);
  const pies = (x: Side) => [{ label: "Ichki", value: x.vvl, color: "var(--c-pri)" }, { label: "Xalqaro", value: x.xal, color: "var(--c-sec)" }];

  const fltTot = U.rej + Q.rej;
  const paxTot = U.pax + Q.pax;
  const bajTot = U.baj + Q.baj;
  const kechTot = U.kech + Q.kech;
  const bekTot = U.bek + Q.bek;
  const vvlTot = U.vvl + Q.vvl;
  const xalTot = U.xal + Q.xal;
  const onTimeTot = Math.max(0, bajTot - kechTot);
  const pendingTot = Math.max(0, fltTot - bajTot - bekTot);
  const avgPax = fltTot ? Math.round(paxTot / fltTot) : 0;
  const avgCargoT = fltTot ? N1(T(U.yuk + Q.yuk) / fltTot) : "0";

  type M = { k: string; d: number; a: number };
  const merge = (dep: any[] | undefined, arr: any[] | undefined): M[] => { const m: Record<string, M> = {}; (dep || []).forEach((r) => { m[r.k] = { k: r.k, d: +r.n || 0, a: 0 }; }); (arr || []).forEach((r) => { (m[r.k] = m[r.k] || { k: r.k, d: 0, a: 0 }).a = +r.n || 0; }); return Object.keys(m).map((k) => m[k]).sort((x, y) => y.d + y.a - (x.d + x.a)); };
  const cRows = merge(s.davlat?.dep, s.davlat?.arr), cMax = Math.max(1, ...cRows.slice(0, 10).map((r) => Math.max(r.d, r.a)));
  const cD = cRows.reduce((t, r) => t + r.d, 0), cA = cRows.reduce((t, r) => t + r.a, 0), cTot = cD + cA;
  const eco = U.py + Q.py, biz = U.pc + Q.pc, first = U.pf + Q.pf, clsTot = eco + biz + first, CIRC = 2 * Math.PI * 50;
  const segs = (() => { let off = 0; return [{ l: "Ekonom", v: eco, c: "var(--c-pri)" }, { l: "Biznes", v: biz, c: "#38bdf8" }, { l: "Birinchi", v: first, c: "var(--c-sec)" }].map((g) => { const len = clsTot ? (g.v / clsTot) * CIRC : 0, o = { ...g, len, off }; off += len; return o; }); })();
  const ages = [{ l: "Kattalar", d: U.ad, a: Q.ad }, { l: "Bolalar", d: U.ch, a: Q.ch }, { l: "Chaqaloqlar", d: U.inf, a: Q.inf }], ageTot = ages.reduce((t, g) => t + g.d + g.a, 0);
  const akRows = merge(s.ak?.dep, s.ak?.arr), akTot = fltTot || akRows.reduce((t, r) => t + r.d + r.a, 0);
  const LOGO = ["#2563eb", "#1d4ed8", "#0284c7", "#4f46e5", "#0369a1", "#334155"];
  const yRows = merge(s.yon?.dep, s.yon?.arr);
  const mosk = yRows.filter((r) => ["VKO", "DME", "SVO"].indexOf(r.k) >= 0).reduce((t, r) => t + r.d + r.a, 0);

  return (
    <>
      <div className="sut__head" id="sutka">
        <h2>{ICONS.activity}Joriy sutka <small>{s.bugun} · {tas} Toshkent vaqti ({s.hozir} UTC) holatiga</small></h2>
      </div>

      <div className="sut">
        <Card title="Asosiy koʻrsatkichlar" hint="Uchish va qoʻnish balans kesimi">
          <div className="sut__cols sut__cols--3">
            <span />
            <span><i className="sut__dot sut__dot--dep" aria-hidden="true" />Uchish</span>
            <span><i className="sut__dot sut__dot--arr" aria-hidden="true" />Qoʻnish</span>
            <span className="n">Jami</span>
          </div>
          <Pair
            icon="dep"
            label="Jami reyslar (reja)"
            dep={{ val: N(U.rej), bar: ratio(U.rej, fltTot) }}
            arr={{ val: N(Q.rej), bar: ratio(Q.rej, fltTot) }}
            total={N(fltTot)}
          />
          <Pair
            icon="users"
            label="Jami yoʻlovchilar"
            dep={{ val: N(U.pax), bar: ratio(U.pax, paxTot) }}
            arr={{ val: N(Q.pax), bar: ratio(Q.pax, paxTot) }}
            total={N(paxTot)}
          />
          <Pair
            icon="done"
            label="Amalda uchgan / qoʻngan"
            dep={{ val: N(U.baj), pill: pct(U.baj, U.rej), bar: ratio(U.baj, U.rej) }}
            arr={{ val: N(Q.baj), pill: pct(Q.baj, Q.rej), bar: ratio(Q.baj, Q.rej) }}
            total={N(bajTot)}
          />
          <Pair
            icon="clock"
            label="Kechikkan reyslar"
            dep={{ val: N(U.kech), pill: pct(U.kech, U.rej), warn: true, bar: ratio(U.kech, U.rej) }}
            arr={{ val: N(Q.kech), pill: pct(Q.kech, Q.rej), warn: true, bar: ratio(Q.kech, Q.rej) }}
            total={N(kechTot)}
          />
          <Pair
            icon="cargo"
            label="Yuk + pochta"
            dep={{ val: kgNode(U.yuk), bar: ratio(U.yuk, U.yuk + Q.yuk) }}
            arr={{ val: kgNode(Q.yuk), bar: ratio(Q.yuk, U.yuk + Q.yuk) }}
            total={kgNode(U.yuk + Q.yuk)}
          />
          <Pair
            icon="alert"
            label="Bekor qilingan reyslar"
            dep={{ val: N(U.bek) }}
            arr={{ val: N(Q.bek) }}
            total={N(bekTot)}
            tone="red"
          />
        </Card>

        <Card title="Ichki va xalqaro reyslar" hint="Yoʻnalish turi va operatsion holat" tools={<span className="sx__badge">{N(fltTot)} reys</span>}>
          <div className="sut__ibal">
            <span><i style={{ background: "var(--c-pri)" }} />Ichki <b>{N(vvlTot)}</b> · {pct(vvlTot, fltTot)}</span>
            <span><i style={{ background: "var(--c-sec)" }} />Xalqaro (MDH) <b>{N(xalTot)}</b> · {pct(xalTot, fltTot)}</span>
          </div>
          <ProportionalBar segments={[{ label: "Ichki", value: vvlTot, color: "var(--c-pri)" }, { label: "Xalqaro (MDH bilan)", value: xalTot, color: "var(--c-sec)" }]} />

          <div className="sut__subs">
            <div className="sut__sub">
              <h4>{ICONS.dep}Uchish</h4>
              <Donut vertical showPct parts={pies(U)} total={U.rej} caption="reys" />
            </div>
            <div className="sut__sub">
              <h4>{ICONS.arr}Qoʻnish</h4>
              <Donut vertical showPct parts={pies(Q)} total={Q.rej} caption="reys" />
            </div>
          </div>

          <div className="sut__ops">
            <div className="sut__ops-h">
              <span>Operatsion holat</span>
              <small>{`${N(avgPax)} yoʻlovchi / reys · ${avgCargoT} t / reys`}</small>
            </div>
            <ProportionalBar segments={[
              { label: "Oʻz vaqtida", value: onTimeTot, color: "var(--c-pri)" },
              { label: "Kechikkan", value: kechTot, color: "#818cf8" },
              { label: "Kutilmoqda", value: pendingTot, color: "var(--v-line-hi)" },
              { label: "Bekor qilindi", value: bekTot, color: "#f43f5e" },
            ]} />
            <div className="sut__ops-chips">
              <div><span><i style={{ background: "var(--c-pri)" }} />Oʻz vaqtida</span><b>{N(onTimeTot)}</b></div>
              <div><span><i style={{ background: "#818cf8" }} />Kechikkan</span><b>{N(kechTot)}</b></div>
              <div><span><i style={{ background: "var(--v-line-hi)" }} />Kutilmoqda</span><b>{N(pendingTot)}</b></div>
            </div>
          </div>
        </Card>

        <Card title="Top 10 davlat" hint="Reyslar soni (Oʻzbekistonsiz), uchish va qoʻnish" tools={<span className="sx__badge">Oʻzbekistonsiz</span>}>
          <div className="sx__bf">
            <div className="sx__bfh"><span>Uchish (reyslar)</span><span>Davlat</span><span>Qoʻnish (reyslar)</span></div>
            {cRows.slice(0, 10).map((r) => (
              <div className="sx__bfr" key={r.k}>
                <b>{N(r.d)}</b>
                <i className="sx__bar sx__bar--l"><u style={{ width: (r.d / cMax) * 100 + "%" }} /></i>
                <span title={r.k}>{cName(r.k)}</span>
                <i className="sx__bar sx__bar--r"><u style={{ width: (r.a / cMax) * 100 + "%" }} /></i>
                <b>{N(r.a)}</b>
              </div>
            ))}
          </div>
          <div className="sx__foot"><span>{cRows[0] ? `Asosiy yoʻnalish: ${cName(cRows[0].k)} (${pct(cRows[0].d + cRows[0].a, cTot)} reyslar)` : ""}</span><span>{`Jami: ${N(cD)} uchish / ${N(cA)} qoʻnish`}</span></div>
        </Card>

        <Card title="Yoʻlovchilar tarkibi" hint="Yosh va xizmat sinfi boʻyicha (LDM)" tools={<span className="sx__tot"><small>Jami yoʻlovchi</small><b>{N(ageTot)}</b></span>}>
          <ProportionalBar segments={[{ label: "Ekonom", value: eco, color: "var(--c-pri)" }, { label: "Biznes", value: biz, color: "#38bdf8" }, { label: "Birinchi sinf", value: first, color: "var(--c-sec)" }]} />
          <div className="sx__ps" style={{ marginTop: 12 }}>
            <div className="sx__don">
              <svg viewBox="0 0 140 140" width="144" height="144" aria-hidden="true">
                <circle cx="70" cy="70" r="50" fill="none" stroke="var(--v-track)" strokeWidth="14" />
                {segs.map((g) => {
                  const len = Math.max(0, g.len - (clsTot > 0 && g.v > 0 ? 5 : 0));
                  return len > 0 ? <circle key={g.l} cx="70" cy="70" r="50" fill="none" stroke={g.c} strokeWidth="14" strokeLinecap="round" strokeDasharray={len + " " + (CIRC - len)} strokeDashoffset={-g.off - 2.5} transform="rotate(-90 70 70)" /> : null;
                })}
                <text x="70" y="62" textAnchor="middle" className="sx__dl">Ekonom</text>
                <text x="70" y="82" textAnchor="middle" className="sx__dv">{clsTot ? ((eco / clsTot) * 100).toFixed(1).replace(".", ",") + "%" : "—"}</text>
                <text x="70" y="96" textAnchor="middle" className="sx__dl">{N(eco)}</text>
              </svg>
              <ul className="sx__leg">
                <li><i style={{ background: "var(--c-pri)" }} />Ekonom <b>{N(eco)}</b><small>{N(U.py)} / {N(Q.py)}</small></li>
                <li><i style={{ background: "#38bdf8" }} />Biznes <b>{N(biz)}</b><small>{N(U.pc)} / {N(Q.pc)}</small></li>
                <li><i style={{ background: "var(--c-sec)" }} />Birinchi sinf <b>{N(first)}</b><small>{N(U.pf)} / {N(Q.pf)}</small></li>
              </ul>
            </div>
            <div className="sx__age">
              <h4>Yosh guruhlari <span>Uchish vs qoʻnish</span></h4>
              {ages.map((g) => (
                <div className="sx__ac" key={g.l}>
                  <div className="sx__ach"><span>{g.l}</span><b>{N(g.d + g.a)}<small>{pct(g.d + g.a, ageTot)}</small></b></div>
                  <div className="sx__split"><u style={{ width: ((g.d / ((g.d + g.a) || 1)) * 100) + "%" }} /><u className="a" style={{ width: ((g.a / ((g.d + g.a) || 1)) * 100) + "%" }} /></div>
                  <div className="sx__acf"><span>{N(g.d)} uchish</span><span>{N(g.a)} qoʻnish</span></div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Top 10 aviakompaniya" hint="Bugungi reyslar soni, uchish va qoʻnish" tools={<span className="sx__badge">{`Jami: ${N(akTot)} reys`}</span>}>
          <div className="sx__tbl">
            <div className="sx__th"><span>#</span><span>Aviakompaniya</span><span>Uchish / qoʻnish</span><span>Jami / ulush</span></div>
            {akRows.slice(0, 5).map((r, i) => (
              <div className={"sx__tr" + (i === 0 ? " sx__tr--first" : "")} key={r.k}>
                <span className="sx__n">{String(i + 1).padStart(2, "0")}</span>
                <span className="sx__al"><em style={{ background: LOGO[r.k.charCodeAt(0) % LOGO.length] }}>{r.k.slice(0, 2)}</em><b>{akName(r.k)}</b></span>
                <span className="sx__da"><span><b className="d">{N(r.d)}</b> / <b className="a">{N(r.a)}</b></span><span className="sx__split sx__split--s"><u style={{ width: ((r.d / ((r.d + r.a) || 1)) * 100) + "%" }} /><u className="a" style={{ width: ((r.a / ((r.d + r.a) || 1)) * 100) + "%" }} /></span></span>
                <span className="sx__tt"><b>{N(r.d + r.a)}</b><small>{pct(r.d + r.a, akTot)}</small></span>
              </div>
            ))}
          </div>
          <div className="sx__other">{akRows.length > 5 ? <><span>Boshqa tashuvchilar:</span>{akRows.slice(5, 9).map((r) => <span key={r.k}><b>{akName(r.k)}</b> {N(r.d + r.a)}</span>)}</> : null}</div>
          <div className="sx__foot"><span>{akRows.length >= 3 ? `Top-3 aviakompaniya reyslar dasturining ${pct(akRows[0].d + akRows[0].a + akRows[1].d + akRows[1].a + akRows[2].d + akRows[2].a, akTot)} ini tashkil etadi` : ""}</span></div>
        </Card>

        <Card title="Top 10 yoʻnalish" hint="Reyslar soni (Toshkent — TAS — chiqarilgan)" tools={<span className="sx__badge">Toshkent (TAS) istisno</span>}>
          <div className="sx__rt">
            {yRows.slice(0, 6).map((r) => (
              <div className="sx__rc" key={r.k}>
                <div className="sx__rch"><em>{r.k}</em><span>{N(r.d + r.a)} reys</span></div>
                <b>{placeName(r.k)}</b>
                <div className="sx__rcf"><span className="d">{N(r.d)}</span><span className="a">{N(r.a)}</span></div>
              </div>
            ))}
          </div>
          <div className="sx__chips">
            {yRows.slice(6, 10).map((r) => <span key={r.k}><b>{r.k} {placeName(r.k)}</b><small>{N(r.d + r.a)} reys</small><i>{N(r.d)} / {N(r.a)}</i></span>)}
          </div>
          {mosk ? <div className="sx__foot"><span>{`Moskva aviauzeli (VKO+DME+SVO): kuniga ${N(mosk)} reys`}</span></div> : null}
        </Card>
      </div>
    </>
  );
}
