/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, type ReactNode } from "react";
import { N, T } from "@/lib/format";
import { useDash, useLookups } from "@/lib/dash";
import { Card, Donut, Rank } from "../charts";
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

// bitta qatorda ikkita katta son: uchish | qoʻnish
function Pair({ icon, label, a, b, tone }: { icon: string; label: string; a: ReactNode; b: ReactNode; tone?: "red" }) {
  return (
    <div className="sut__row">
      <span className="sut__lbl">{ICONS[icon]}{label}</span>
      <b className={"sut__num sut__num--dep" + (tone ? " " + tone : "")}>{a}</b>
      <b className={"sut__num sut__num--arr" + (tone ? " " + tone : "")}>{b}</b>
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
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + "%" : "—");
  const kg = (v: number) => (v >= 100000 ? N(T(v)) + " t" : N(v) + " kg");
  const list = (rows: any[] | undefined, nameFn: (k: string) => string, tone?: string) =>
    <Rank tone={tone} items={(rows || []).map((r) => (nameFn === cName ? { code: cName(r.k), value: r.n } : { code: r.k, sub: nameFn(r.k), value: r.n }))} />;
  const pies = (x: Side) => [{ label: "Ichki", value: x.vvl, color: "#0f766e" }, { label: "Xalqaro (MDH bilan)", value: x.xal, color: "#f08a3c" }];
  const age = (x: Side) => [{ code: "Kattalar", value: x.ad }, { code: "Bolalar", value: x.ch }, { code: "Chaqaloqlar", value: x.inf }];
  const cls = (x: Side) => [{ code: "Birinchi sinf", value: x.pf }, { code: "Biznes", value: x.pc }, { code: "Ekonom", value: x.py }];

  return (
    <>
      <div className="sut__head" id="sutka">
        <h2>{ICONS.activity}Joriy sutka <small>{s.bugun} · {s.hozir} UTC holatiga</small></h2>
        <p>Barcha aeroportlar boʻyicha · rahbariyat (Grafana) dashboardi bilan bir xil hisob: UTC kuni, bekorlarsiz, LDM boʻyicha yoʻlovchilar. Aeroport tanlovi bu boʻlimga taʼsir qilmaydi.</p>
      </div>

      <div className="sut">
        <Card title="Asosiy koʻrsatkichlar" hint="Uchish va qoʻnish alohida">
          <div className="sut__cols"><span /><span>{ICONS.dep}Uchish</span><span>{ICONS.arr}Qoʻnish</span></div>
          <Pair icon="dep" label="Jami reyslar (reja)" a={N(U.rej)} b={N(Q.rej)} />
          <Pair icon="users" label="Jami yoʻlovchilar" a={N(U.pax)} b={N(Q.pax)} />
          <Pair icon="done" label="Bajarilgan reyslar" a={<>{N(U.baj)}<small>{pct(U.baj, U.rej)}</small></>} b={<>{N(Q.baj)}<small>{pct(Q.baj, Q.rej)}</small></>} />
          <Pair icon="clock" label="Kechikkan reyslar" a={N(U.kech)} b={N(Q.kech)} />
          <Pair icon="cargo" label="Yuk + pochta" a={kg(U.yuk)} b={kg(Q.yuk)} />
          <Pair icon="alert" label="Bekor qilingan reyslar" a={N(U.bek)} b={N(Q.bek)} tone="red" />
        </Card>

        <Card title="Ichki va xalqaro reyslar" hint="Reyslar turi boʻyicha: uchish va qoʻnish">
          <div className="sut__pies">
            <div><h4>{ICONS.dep}Uchish</h4><Donut parts={pies(U)} total={U.rej} caption="reys" /></div>
            <div><h4>{ICONS.arr}Qoʻnish</h4><Donut parts={pies(Q)} total={Q.rej} caption="reys" /></div>
          </div>
        </Card>

        <Card title="Top 10 davlat" hint="Reyslar soni (Oʻzbekistonsiz)">
          <div className="sut__two">
            <div><h4>{ICONS.dep}Uchish</h4>{list(s.davlat?.dep, cName, "warm")}</div>
            <div><h4>{ICONS.arr}Qoʻnish</h4>{list(s.davlat?.arr, cName, "warm")}</div>
          </div>
        </Card>

        <Card title="Yoʻlovchilar tarkibi" hint="Yosh va xizmat sinfi boʻyicha (LDM)">
          <div className="sut__two">
            <div><h4>{ICONS.dep}Uchish</h4><Rank items={age(U)} fmt={N} /><div className="sut__gap" /><Rank tone="warm" items={cls(U)} fmt={N} /></div>
            <div><h4>{ICONS.arr}Qoʻnish</h4><Rank items={age(Q)} fmt={N} /><div className="sut__gap" /><Rank tone="warm" items={cls(Q)} fmt={N} /></div>
          </div>
        </Card>

        <Card title="Top 10 aviakompaniya" hint="Bugungi reyslar soni">
          <div className="sut__two">
            <div><h4>{ICONS.dep}Uchish</h4>{list(s.ak?.dep, akName)}</div>
            <div><h4>{ICONS.arr}Qoʻnish</h4>{list(s.ak?.arr, akName)}</div>
          </div>
        </Card>

        <Card title="Top 10 yoʻnalish" hint="Reyslar soni (Toshkent — TAS — chiqarilgan)">
          <div className="sut__two">
            <div><h4>{ICONS.dep}Uchish</h4>{list(s.yon?.dep, placeName, "warm")}</div>
            <div><h4>{ICONS.arr}Qoʻnish</h4>{list(s.yon?.arr, placeName, "warm")}</div>
          </div>
        </Card>
      </div>
    </>
  );
}

