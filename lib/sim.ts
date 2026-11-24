/* eslint-disable @typescript-eslint/no-explicit-any */
// 5+ yillik (2021-01-01 dan bugungacha) real Uzbekistan Airports statistikasiga tayangan
// deterministik immitatsiya maʼlumotlar dvigateli (server/DB ulanishisiz ishlaydi).
import { AP_LIST, AP_NAME } from "./static";

export const SIM_START = "2021-01-01";
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- yordamchi funksiyalar
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngOf(seedStr: string) {
  let a = hashStr(seedStr) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const toIsoDate = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const parseUtcDay = (s: string) => Date.parse(s + "T00:00:00Z");
const addDaysStr = (s: string, delta: number) => toIsoDate(new Date(parseUtcDay(s) + delta * DAY_MS));
const stampLocal = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const hmUtc = (minOfDay: number) => {
  const m = ((Math.round(minOfDay) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};

// ---------------------------------------------------------------- Uzbekistan Airports haqiqiy ma'lumotlariga tayangan parametrlar
// Manba: Uzbekistan Airports 2021-2026 rasmiy hisobotlari (pax, flights, cargo)
type YearSpec = { pax: number; flights: number; cargoT: number; domFlightShare: number; domPaxShare: number; otp: number; cancel: number };
const YEAR_SPECS: Record<number, YearSpec> = {
  2021: { pax: 5_410_000, flights: 49_200, cargoT: 58_200, domFlightShare: 0.24, domPaxShare: 0.17, otp: 0.855, cancel: 0.014 },
  2022: { pax: 7_900_000, flights: 68_800, cargoT: 80_100, domFlightShare: 0.28, domPaxShare: 0.215, otp: 0.872, cancel: 0.011 },
  2023: { pax: 10_387_000, flights: 85_430, cargoT: 71_100, domFlightShare: 0.285, domPaxShare: 0.192, otp: 0.884, cancel: 0.009 },
  2024: { pax: 13_503_199, flights: 113_622, cargoT: 87_461, domFlightShare: 0.294, domPaxShare: 0.184, otp: 0.896, cancel: 0.008 },
  2025: { pax: 15_504_264, flights: 128_972, cargoT: 98_137, domFlightShare: 0.283, domPaxShare: 0.180, otp: 0.908, cancel: 0.007 },
  2026: { pax: 16_830_000, flights: 136_700, cargoT: 112_700, domFlightShare: 0.303, domPaxShare: 0.182, otp: 0.914, cancel: 0.0065 },
};
const specForYear = (y: number): YearSpec => {
  if (YEAR_SPECS[y]) return YEAR_SPECS[y];
  if (y < 2021) return YEAR_SPECS[2021];
  const base = YEAR_SPECS[2026];
  const k = Math.pow(1.09, y - 2026);
  return { ...base, pax: Math.round(base.pax * k), flights: Math.round(base.flights * k), cargoT: Math.round(base.cargoT * k) };
};

// Mavsumiylik (oylar bo'yicha, yig'indi = 12.00)
const MONTH_SEASON = [0.79, 0.74, 0.87, 0.94, 1.04, 1.12, 1.19, 1.23, 1.11, 1.07, 0.95, 0.95];
// Hafta kunlari (Yakshanba=0 .. Shanba=6)
const WEEKDAY_FACTOR = [1.06, 0.96, 0.93, 0.95, 1.01, 1.08, 1.01];

// Har bir aeroportning ulushi (yil bo'yicha dinamik: SKD 2022da terminal ochilishi, AZN 2023-2025 rekonstruksiya, kichik aeroportlar 2023+)
type ApProfile = {
  paxW: (y: number, m: number) => number;
  fltW: (y: number, m: number) => number;
  cargoW: number;
  domShare: number; // aeroportdagi ichki reyslar ulushi
  cisShare: number; // xalqaro ichida MDH ulushi
  ter: string[];
};

const AP_PROFILES: Record<string, ApProfile> = {
  TAS: { paxW: (y) => (y >= 2026 ? 0.665 : y >= 2025 ? 0.645 : 0.635), fltW: (y) => (y >= 2026 ? 0.595 : 0.575), cargoW: 0.915, domShare: 0.21, cisShare: 0.49, ter: ["T2", "T3"] },
  SKD: { paxW: (y, m) => (y === 2021 ? 0.036 : y === 2022 ? (m < 3 ? 0.038 : 0.068) : y === 2023 ? 0.095 : y === 2024 ? 0.102 : y === 2025 ? 0.098 : 0.089), fltW: (y, m) => (y === 2021 ? 0.042 : y === 2022 && m < 3 ? 0.045 : 0.085), cargoW: 0.014, domShare: 0.23, cisShare: 0.55, ter: ["T1"] },
  UGC: { paxW: (y) => (y >= 2026 ? 0.058 : 0.056), fltW: () => 0.054, cargoW: 0.005, domShare: 0.44, cisShare: 0.62, ter: ["T1"] },
  NMA: { paxW: (y) => (y >= 2026 ? 0.040 : y >= 2025 ? 0.056 : 0.058), fltW: (y) => (y >= 2026 ? 0.044 : 0.056), cargoW: 0.006, domShare: 0.24, cisShare: 0.72, ter: ["T1"] },
  FEG: { paxW: () => 0.041, fltW: () => 0.044, cargoW: 0.004, domShare: 0.28, cisShare: 0.70, ter: ["T1"] },
  BHK: { paxW: (y) => (y >= 2026 ? 0.033 : 0.037), fltW: () => 0.042, cargoW: 0.004, domShare: 0.42, cisShare: 0.64, ter: ["T1"] },
  NCU: { paxW: () => 0.022, fltW: () => 0.028, cargoW: 0.002, domShare: 0.65, cisShare: 0.78, ter: ["T1"] },
  NVI: { paxW: () => 0.015, fltW: () => 0.024, cargoW: 0.044, domShare: 0.48, cisShare: 0.42, ter: ["T1"] },
  TMJ: { paxW: (y) => (y >= 2026 ? 0.021 : 0.015), fltW: (y) => (y >= 2026 ? 0.022 : 0.017), cargoW: 0.002, domShare: 0.46, cisShare: 0.52, ter: ["T1"] },
  KSQ: { paxW: () => 0.012, fltW: () => 0.015, cargoW: 0.001, domShare: 0.48, cisShare: 0.75, ter: ["T1"] },
  // Andijon: 2023-yil maydan 2025-yil fevralgacha rekonstruksiya sababli yopiq edi, 2025-yil martdan ochildi
  AZN: { paxW: (y, m) => (y < 2023 ? 0.012 : y === 2023 && m < 5 ? 0.009 : y === 2025 && m >= 3 ? 0.005 : y >= 2026 ? 0.013 : 0), fltW: (y, m) => (y < 2023 ? 0.014 : y === 2023 && m < 5 ? 0.011 : y === 2025 && m >= 3 ? 0.007 : y >= 2026 ? 0.015 : 0), cargoW: 0.001, domShare: 0.58, cisShare: 0.76, ter: ["T1"] },
  // Hududiy kichik aeroportlar (Silk Avia L-410 / ATR-72 asosan 2023-2026)
  OQN: { paxW: (y) => (y >= 2024 ? 0.0014 : 0), fltW: (y) => (y >= 2024 ? 0.0045 : 0), cargoW: 0.0002, domShare: 1.0, cisShare: 0, ter: ["T1"] },
  OMN: { paxW: (y) => (y >= 2023 ? 0.0009 : 0), fltW: (y) => (y >= 2023 ? 0.0038 : 0), cargoW: 0.0001, domShare: 1.0, cisShare: 0, ter: ["T1"] },
  RBZ: { paxW: (y) => (y >= 2024 ? 0.0008 : 0), fltW: (y) => (y >= 2024 ? 0.0032 : 0), cargoW: 0.0001, domShare: 1.0, cisShare: 0, ter: ["T1"] },
  MOK: { paxW: (y) => (y >= 2023 ? 0.0004 : 0), fltW: (y) => (y >= 2023 ? 0.0018 : 0), cargoW: 0.0001, domShare: 1.0, cisShare: 0, ter: ["T1"] },
  SRS: { paxW: (y) => (y >= 2024 ? 0.0005 : 0), fltW: (y) => (y >= 2024 ? 0.0020 : 0), cargoW: 0.0001, domShare: 1.0, cisShare: 0, ter: ["T1"] },
  AFS: { paxW: (y) => (y >= 2023 ? 0.0004 : 0), fltW: (y) => (y >= 2023 ? 0.0016 : 0), cargoW: 0.0002, domShare: 1.0, cisShare: 0, ter: ["T1"] },
  COH: { paxW: (y) => (y >= 2024 ? 0.0002 : 0), fltW: (y) => (y >= 2024 ? 0.0010 : 0), cargoW: 0.0001, domShare: 1.0, cisShare: 0, ter: ["T1"] },
  IYO: { paxW: (y) => (y >= 2025 ? 0.0002 : 0), fltW: (y) => (y >= 2025 ? 0.0009 : 0), cargoW: 0.0001, domShare: 1.0, cisShare: 0, ter: ["T1"] },
};

// ---------------------------------------------------------------- Lug'atlar (aviakompaniyalar, aeroportlar, samolyotlar, xizmatlar)
const AIRLINES: Record<string, { name: string; baseW: number; since?: number; dom?: boolean; cargo?: boolean; charter?: boolean; otpAdj: number }> = {
  HY: { name: "Uzbekistan Airways", baseW: 41.5, dom: true, otpAdj: 0.015 },
  C6: { name: "Centrum Air", baseW: 13.5, since: 2023, dom: true, cargo: true, otpAdj: -0.01 },
  HH: { name: "Qanot Sharq", baseW: 7.4, since: 2021, dom: true, charter: true, otpAdj: -0.005 },
  SU: { name: "Aeroflot", baseW: 6.4, otpAdj: 0.01 },
  TK: { name: "Turkish Airlines", baseW: 5.9, otpAdj: 0.02 },
  FZ: { name: "flydubai", baseW: 4.1, otpAdj: 0.015 },
  "9S": { name: "Air Samarkand", baseW: 2.8, since: 2023, charter: true, otpAdj: -0.012 },
  US: { name: "Silk Avia", baseW: 2.9, since: 2023, dom: true, otpAdj: 0.022 },
  G9: { name: "Air Arabia", baseW: 2.6, otpAdj: 0.01 },
  S7: { name: "S7 Airlines", baseW: 2.3, otpAdj: 0.005 },
  U6: { name: "Ural Airlines", baseW: 2.2, otpAdj: -0.025 },
  KC: { name: "Air Astana", baseW: 1.8, otpAdj: 0.018 },
  UT: { name: "Utair", baseW: 1.4, otpAdj: -0.015 },
  DP: { name: "Pobeda", baseW: 1.4, otpAdj: 0.01 },
  FV: { name: "Rossiya Airlines", baseW: 1.3, otpAdj: 0.005 },
  J2: { name: "AZAL Azerbaijan Airlines", baseW: 1.2, otpAdj: 0.012 },
  XY: { name: "flynas", baseW: 1.2, since: 2022, otpAdj: -0.01 },
  F3: { name: "flyadeal", baseW: 1.0, since: 2024, otpAdj: -0.005 },
  QR: { name: "Qatar Airways", baseW: 1.1, since: 2024, otpAdj: 0.03 },
  CZ: { name: "China Southern Airlines", baseW: 1.1, since: 2023, otpAdj: 0.01 },
  CA: { name: "Air China", baseW: 0.7, since: 2025, otpAdj: 0.015 },
  MU: { name: "China Eastern Airlines", baseW: 0.7, since: 2025, otpAdj: 0.01 },
  KE: { name: "Korean Air", baseW: 0.9, otpAdj: 0.025 },
  OZ: { name: "Asiana Airlines", baseW: 0.8, otpAdj: 0.02 },
  TW: { name: "T'way Air", baseW: 0.6, since: 2025, otpAdj: 0.005 },
  LO: { name: "LOT Polish Airlines", baseW: 0.6, since: 2024, otpAdj: 0.015 },
  "2U": { name: "Fly Khiva", baseW: 1.2, since: 2024, cargo: true, charter: true, otpAdj: -0.01 },
  DV: { name: "SCAT Airlines", baseW: 0.8, otpAdj: -0.005 },
  FS: { name: "FlyArystan", baseW: 0.8, since: 2023, otpAdj: 0.0 },
  SZ: { name: "Somon Air", baseW: 0.7, otpAdj: -0.008 },
  "5W": { name: "Wizz Air Abu Dhabi", baseW: 1.0, since: 2023, otpAdj: 0.0 },
  WZ: { name: "Red Wings", baseW: 1.1, charter: true, otpAdj: -0.03 },
  N4: { name: "Nordwind Airlines", baseW: 0.9, charter: true, otpAdj: -0.02 },
  B2: { name: "Belavia", baseW: 0.7, otpAdj: 0.015 },
  PC: { name: "Pegasus Airlines", baseW: 0.8, since: 2024, otpAdj: 0.0 },
  VF: { name: "AJet", baseW: 0.6, since: 2024, otpAdj: -0.005 },
  MS: { name: "EgyptAir", baseW: 0.5, since: 2023, charter: true, otpAdj: -0.015 },
  A4: { name: "Azimuth", baseW: 0.6, since: 2022, otpAdj: -0.02 },
  HJ: { name: "Humo Air", baseW: 0.5, since: 2023, dom: true, otpAdj: -0.01 },
};

type DestInfo = { n: string; e: string; c: string; ruC: string; yon: "MVL" | "CIS" | "VVL"; w: number };
const DESTS: Record<string, DestInfo> = {
  VKO: { n: "Москва (Внуково)", e: "Moskva VKO", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 12.5 },
  DME: { n: "Москва (Домодедово)", e: "Moskva DME", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 9.2 },
  SVO: { n: "Москва (Шереметьево)", e: "Moskva SVO", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 7.4 },
  IST: { n: "Стамбул", e: "Istanbul", c: "Turkiya", ruC: "Турция", yon: "MVL", w: 11.8 },
  DXB: { n: "Дубай", e: "Dubay", c: "BAA", ruC: "Объединенные Арабские Эмираты", yon: "MVL", w: 6.8 },
  JED: { n: "Джидда", e: "Jidda", c: "Saudiya Arabistoni", ruC: "Саудовская Аравия", yon: "MVL", w: 5.5 },
  LED: { n: "Санкт-Петербург", e: "Sankt-Peterburg", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 5.4 },
  ALA: { n: "Алматы", e: "Almati", c: "Qozogʻiston", ruC: "Республика Казахстан", yon: "CIS", w: 4.9 },
  MED: { n: "Медина", e: "Madina", c: "Saudiya Arabistoni", ruC: "Саудовская Аравия", yon: "MVL", w: 3.6 },
  SHJ: { n: "Шарджа", e: "Sharja", c: "BAA", ruC: "Объединенные Арабские Эмираты", yon: "MVL", w: 3.2 },
  AUH: { n: "Абу-Даби", e: "Abu-Dabi", c: "BAA", ruC: "Объединенные Арабские Эмираты", yon: "MVL", w: 2.9 },
  NQZ: { n: "Астана", e: "Ostona", c: "Qozogʻiston", ruC: "Республика Казахстан", yon: "CIS", w: 2.7 },
  ICN: { n: "Сеул (Инчхон)", e: "Seul", c: "Koreya", ruC: "Корейская Республика", yon: "MVL", w: 2.8 },
  AYT: { n: "Анталья", e: "Antalya", c: "Turkiya", ruC: "Турция", yon: "MVL", w: 2.9 },
  AER: { n: "Сочи", e: "Sochi", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 2.3 },
  OVB: { n: "Новосибирск", e: "Novosibirsk", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 2.1 },
  KZN: { n: "Казань", e: "Qozon", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 2.2 },
  SVX: { n: "Екатеринбург", e: "Yekaterinburg", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 2.0 },
  GYD: { n: "Баку", e: "Boku", c: "Ozarbayjon", ruC: "Азербайджанская Республика", yon: "CIS", w: 2.1 },
  DOH: { n: "Доха", e: "Doha", c: "Qatar", ruC: "Катар", yon: "MVL", w: 1.9 },
  FRU: { n: "Бишкек", e: "Bishkek", c: "Qirgʻiziston", ruC: "Кыргызская Республика", yon: "CIS", w: 1.9 },
  DYU: { n: "Душанбе", e: "Dushanbe", c: "Tojikiston", ruC: "Республика Таджикистан", yon: "CIS", w: 1.7 },
  TBS: { n: "Тбилиси", e: "Tbilisi", c: "Gruziya", ruC: "Грузия", yon: "MVL", w: 1.8 },
  URC: { n: "Урумчи", e: "Urumchi", c: "Xitoy", ruC: "Китай", yon: "MVL", w: 1.7 },
  PKX: { n: "Пекин (Дасин)", e: "Pekin", c: "Xitoy", ruC: "Китай", yon: "MVL", w: 1.6 },
  CAN: { n: "Гуанчжоу", e: "Guanchjou", c: "Xitoy", ruC: "Китай", yon: "MVL", w: 1.3 },
  SSH: { n: "Шарм-эш-Шейх", e: "Sharm el-Sheikh", c: "Misr", ruC: "Египет", yon: "MVL", w: 1.9 },
  HKT: { n: "Пхукет", e: "Pxuket", c: "Tailand", ruC: "Таиланд", yon: "MVL", w: 1.4 },
  BKK: { n: "Бангкок", e: "Bangkok", c: "Tailand", ruC: "Таиланд", yon: "MVL", w: 1.2 },
  DEL: { n: "Дели", e: "Dehli", c: "Hindiston", ruC: "Индия", yon: "MVL", w: 1.6 },
  FRA: { n: "Франкфурт", e: "Frankfurt", c: "Germaniya", ruC: "Германия", yon: "MVL", w: 1.5 },
  LGW: { n: "Лондон (Гатвик)", e: "London", c: "Buyuk Britaniya", ruC: "Великобритания", yon: "MVL", w: 1.1 },
  KUL: { n: "Куала-Лумпур", e: "Kuala-Lumpur", c: "Malayziya", ruC: "Малайзия", yon: "MVL", w: 1.0 },
  MSQ: { n: "Минск", e: "Minsk", c: "Belarus", ruC: "Республика Беларусь", yon: "CIS", w: 1.3 },
  CXR: { n: "Камрань (Нячанг)", e: "Nyachang", c: "Vyetnam", ruC: "Вьетнам", yon: "MVL", w: 1.1 },
  UFA: { n: "Уфа", e: "Ufa", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 1.4 },
  KUF: { n: "Самара", e: "Samara", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 1.3 },
  MRV: { n: "Минеральные Воды", e: "Mineralniye Vody", c: "Rossiya", ruC: "Российская Федерация (Россия)", yon: "CIS", w: 1.2 },
  SAW: { n: "Стамбул (Сабиха)", e: "Istanbul SAW", c: "Turkiya", ruC: "Турция", yon: "MVL", w: 1.6 },
  TLV: { n: "Тель-Авив", e: "Tel-Aviv", c: "Isroil", ruC: "Израиль", yon: "MVL", w: 1.1 },
  WAW: { n: "Варшава", e: "Varshava", c: "Polsha", ruC: "Польша", yon: "MVL", w: 0.9 },
  KWI: { n: "Кувейт", e: "Quvayt", c: "Quvayt", ruC: "Кувейт", yon: "MVL", w: 0.8 },
  MLE: { n: "Мале", e: "Male", c: "Maldiv", ruC: "Мальдивы", yon: "MVL", w: 0.8 },
  LBD: { n: "Худжанд", e: "Xoʻjand", c: "Tojikiston", ruC: "Республика Таджикистан", yon: "CIS", w: 0.7 },
  LGG: { n: "Льеж", e: "Lyej", c: "Belgiya", ruC: "Бельгия", yon: "MVL", w: 0.4 },
};

const AIRCRAFT_NAMES: Record<string, string> = {
  "32N": "Airbus A320neo",
  "32Q": "Airbus A321neo",
  "320": "Airbus A320",
  "321": "Airbus A321",
  "788": "Boeing 787-8 Dreamliner",
  "763": "Boeing 767-300ER",
  "76F": "Boeing 767-300F",
  "752": "Boeing 757-200",
  "73H": "Boeing 737-800",
  "332": "Airbus A330-200",
  AT7: "ATR 72-600",
  L4T: "Let L-410UVP-E20",
  E90: "Embraer E190",
  SU9: "Sukhoi Superjet 100",
};

const DELAY_SERVICES: Record<string, string> = {
  AK: "Aviakompaniya",
  PDO: "Parvozlarni taʼminlash xizmati",
  SOP: "Yoʻlovchilarga xizmat koʻrsatish",
  ATB: "Aviatsiya texnik bazasi",
  UVD: "Havo harakatini boshqarish",
  GZM: "Yoqilgʻi-moylash xizmati",
  MET: "Meteoxizmat",
  KARG: "Yuk tashish xizmati",
  SAB: "Aviatsiya xavfsizligi",
};

const DELAY_CODES: { kod: string; xiz: string; w: number; winterBoost?: number; avgMin: number }[] = [
  { kod: "93", xiz: "AK", w: 28, avgMin: 42 },
  { kod: "71", xiz: "MET", w: 10, winterBoost: 2.6, avgMin: 58 },
  { kod: "75", xiz: "PDO", w: 5, winterBoost: 3.4, avgMin: 36 },
  { kod: "81", xiz: "UVD", w: 11, avgMin: 31 },
  { kod: "41", xiz: "ATB", w: 9, avgMin: 64 },
  { kod: "11", xiz: "SOP", w: 7, avgMin: 24 },
  { kod: "15", xiz: "SOP", w: 6, avgMin: 22 },
  { kod: "32", xiz: "PDO", w: 6, avgMin: 29 },
  { kod: "36", xiz: "GZM", w: 5, avgMin: 26 },
  { kod: "63", xiz: "AK", w: 5, avgMin: 38 },
  { kod: "87", xiz: "PDO", w: 4, avgMin: 33 },
  { kod: "22", xiz: "KARG", w: 2, avgMin: 35 },
  { kod: "-", xiz: "-", w: 3, avgMin: 27 },
];

const REZ_REGS: Record<string, { reg: string; vs: string }[]> = {
  HY: [
    ...Array.from({ length: 12 }, (_, i) => ({ reg: `320${11 + i}`, vs: i >= 6 ? "32N" : "320" })),
    ...Array.from({ length: 10 }, (_, i) => ({ reg: `321${1 + i}`, vs: i >= 4 ? "32Q" : "321" })),
    ...Array.from({ length: 7 }, (_, i) => ({ reg: `7870${1 + i}`, vs: "788" })),
    ...Array.from({ length: 7 }, (_, i) => ({ reg: `6700${1 + i}`, vs: i >= 5 ? "76F" : "763" })),
    ...Array.from({ length: 4 }, (_, i) => ({ reg: `7570${1 + i}`, vs: "752" })),
  ],
  C6: [
    ...Array.from({ length: 7 }, (_, i) => ({ reg: `UK3204${1 + i}`, vs: i >= 3 ? "32N" : "320" })),
    ...Array.from({ length: 5 }, (_, i) => ({ reg: `UK3214${1 + i}`, vs: "32Q" })),
    { reg: "UK33041", vs: "332" },
    ...Array.from({ length: 4 }, (_, i) => ({ reg: `UK7674${1 + i}`, vs: "76F" })),
  ],
  HH: [
    { reg: "UK32061", vs: "320" }, { reg: "UK32062", vs: "320" },
    { reg: "UK32161", vs: "321" }, { reg: "UK32162", vs: "32Q" }, { reg: "UK32163", vs: "32Q" },
    { reg: "UK33061", vs: "332" }, { reg: "UK33062", vs: "332" },
  ],
  "9S": [
    { reg: "UK32171", vs: "321" }, { reg: "UK32172", vs: "32Q" }, { reg: "UK33071", vs: "332" },
  ],
  US: [
    ...Array.from({ length: 5 }, (_, i) => ({ reg: `UK7260${1 + i}`, vs: "AT7" })),
    ...Array.from({ length: 4 }, (_, i) => ({ reg: `UK4100${1 + i}`, vs: "L4T" })),
  ],
  "2U": [
    { reg: "UK75711", vs: "752" }, { reg: "UK76711", vs: "76F" }, { reg: "UK76712", vs: "76F" },
  ],
  HJ: [
    { reg: "UK32081", vs: "320" }, { reg: "UK32082", vs: "320" },
  ],
};

// Soatlik harakat taqsimoti (UTC 00..23; Toshkent = UTC+5)
// Eng band vaqtlar: 01-05 UTC (06-10 TAS) va 11-18 UTC (16-23 TAS)
const HOURLY_W_DEP = [3.8, 5.4, 6.8, 7.6, 7.2, 5.6, 4.4, 3.8, 3.6, 3.9, 4.5, 5.2, 5.8, 6.2, 5.9, 5.0, 4.1, 3.4, 2.8, 2.1, 1.5, 1.2, 1.8, 2.8];
const HOURLY_W_ARR = [3.4, 4.6, 5.8, 6.2, 5.5, 4.3, 3.8, 3.9, 4.2, 4.8, 5.4, 6.1, 6.4, 6.2, 5.6, 5.2, 4.8, 4.2, 3.3, 2.5, 1.9, 1.4, 1.9, 2.6];

// ---------------------------------------------------------------- Kunlik agregatlangan jadval (2021-01-01 .. bugun)
export type DayApRec = {
  kun: string;
  oy: string;
  ap: string;
  // uchish (tt=1)
  dbaj: number; drej: number; dbek: number; dpax: number; dyuk: number; dpoc: number; dbag: number; dyoq: number;
  dot: number; ddl: number; ddm: number;
  // qo'nish (tt=2)
  abaj: number; arej: number; abek: number; apax: number; ayuk: number; apoc: number; abag: number;
  aot: number; adl: number; adm: number;
  // yo'nalishlar bo'yicha (VVL=ichki, CIS=MDH, MVL=xalqaro)
  vvl_db: number; vvl_ab: number; vvl_dp: number; vvl_ap: number; vvl_y: number; vvl_u: number;
  cis_db: number; cis_ab: number; cis_dp: number; cis_ap: number; cis_y: number;
  mvl_db: number; mvl_ab: number; mvl_dp: number; mvl_ap: number; mvl_y: number;
  wl: number;
};

type FlightRec = {
  ap: string; tt: 1 | 2; bosh: string; ak: string; nr: string; yon: "MVL" | "CIS" | "VVL"; st: string; vs: string; ter: string;
  kod: string | null; xiz: string | null; fids: string;
  schMin: number; estMin: number | null; fctMin: number | null;
  sch: string; est: string | null; fct: string | null;
  bekor: boolean; ok: boolean; holat: "bajarildi" | "kechikmoqda" | "bekor" | "kutilmoqda";
  kech: number | null; pax: number; pf: number; pc: number; py: number; ad: number; ch: number; inf: number;
  yuk: number; poc: number; bag: number; yoq: number;
};

// Bir kun uchun barcha aeroportlar bo'yicha realistik parvozlar ro'yxatini yaratish (bugun va kecha uchun)
function buildDayFlights(dateStr: string, dayStatMap: Map<string, DayApRec>, nowUtcMin: number | null): FlightRec[] {
  const out: FlightRec[] = [];
  const y = +dateStr.slice(0, 4);

  const pickWeighted = <T,>(items: T[], weights: number[], r: number): T => {
    let tot = 0;
    for (const w of weights) tot += w;
    let x = r * tot;
    for (let i = 0; i < items.length; i++) {
      x -= weights[i];
      if (x <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  const airlineEntries = Object.entries(AIRLINES).filter(([, v]) => !v.since || y >= v.since);
  const domAirlines = airlineEntries.filter(([, v]) => v.dom);
  const intlAirlines = airlineEntries.filter(([, v]) => !v.dom || v.baseW > 3);
  const cargoAirlines = airlineEntries.filter(([, v]) => v.cargo || v.baseW > 10);

  const domDests = AP_LIST.filter((c) => AP_PROFILES[c].domShare > 0);
  const cisDests = Object.entries(DESTS).filter(([, d]) => d.yon === "CIS");
  const mvlDests = Object.entries(DESTS).filter(([, d]) => d.yon === "MVL");

  for (const ap of AP_LIST) {
    const rec = dayStatMap.get(ap);
    if (!rec) continue;
    const rng = rngOf(`flt:${dateStr}:${ap}`);
    const prof = AP_PROFILES[ap];

    const addDirection = (tt: 1 | 2, nVvl: number, nCis: number, nMvl: number, nBek: number, paxTot: number, yukTot: number, pocTot: number, bagTot: number, yoqTot: number, nDelay: number) => {
      const totalFlights = nVvl + nCis + nMvl + nBek;
      if (totalFlights <= 0) return;

      const hourWeights = tt === 1 ? HOURLY_W_DEP : HOURLY_W_ARR;
      const hours = Array.from({ length: 24 }, (_, h) => h);
      const yons: ("VVL" | "CIS" | "MVL")[] = [];
      for (let i = 0; i < nVvl; i++) yons.push("VVL");
      for (let i = 0; i < nCis; i++) yons.push("CIS");
      for (let i = 0; i < nMvl; i++) yons.push("MVL");
      for (let i = 0; i < nBek; i++) yons.push(rng() < 0.7 ? "MVL" : "VVL");

      // Aralashtirish
      for (let i = yons.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = yons[i]; yons[i] = yons[j]; yons[j] = tmp;
      }

      const activeCount = Math.max(1, nVvl + nCis + nMvl);
      let remPax = paxTot, remYuk = yukTot, remPoc = pocTot, remBag = bagTot, remYoq = yoqTot;
      let activeIdx = 0;

      for (let idx = 0; idx < totalFlights; idx++) {
        const yon = yons[idx];
        const bekor = idx >= nVvl + nCis + nMvl;

        let ak = "HY";
        let bosh = "IST";
        if (yon === "VVL") {
          const al = pickWeighted(domAirlines, domAirlines.map(([, v]) => v.baseW), rng());
          ak = al[0];
          const candDom = domDests.filter((c) => c !== ap && (ap === "TAS" || c === "TAS" || rng() < 0.25));
          bosh = candDom.length ? candDom[Math.floor(rng() * candDom.length)] : (ap === "TAS" ? "SKD" : "TAS");
        } else if (yon === "CIS") {
          const al = pickWeighted(intlAirlines, intlAirlines.map(([, v]) => v.baseW), rng());
          ak = al[0];
          bosh = pickWeighted(cisDests, cisDests.map(([, d]) => d.w), rng())[0];
        } else {
          const al = pickWeighted(intlAirlines, intlAirlines.map(([, v]) => v.baseW), rng());
          ak = al[0];
          bosh = pickWeighted(mvlDests, mvlDests.map(([, d]) => d.w), rng())[0];
        }

        const isCargo = !bekor && yon !== "VVL" && rng() < 0.035 && cargoAirlines.length > 0;
        if (isCargo) ak = pickWeighted(cargoAirlines, cargoAirlines.map(([, v]) => v.baseW), rng())[0];
        const st = isCargo ? (rng() < 0.65 ? "F" : "H") : yon !== "VVL" && rng() < 0.11 ? "C" : "J";
        const nr = String(101 + Math.floor(rng() * 880));

        const hr = pickWeighted(hours, hourWeights, rng());
        const min = Math.floor(rng() * 12) * 5;
        const schMin = hr * 60 + min;

        const isDelayed = !bekor && activeIdx < nDelay;
        const delayMin = isDelayed ? Math.round(18 + Math.pow(rng(), 1.8) * 110) : Math.round((rng() - 0.35) * 14);
        const fctMin = bekor ? null : Math.max(0, Math.min(1439, schMin + delayMin));
        const estMin = bekor ? null : isDelayed ? Math.min(1439, schMin + delayMin) : Math.max(0, Math.min(1439, schMin + Math.max(0, delayMin)));

        const dc = isDelayed ? pickWeighted(DELAY_CODES, DELAY_CODES.map((d) => d.w), rng()) : null;
        const vs = isCargo
          ? (rng() < 0.6 ? "76F" : "752")
          : yon === "VVL" && (ak === "US" || prof.domShare > 0.8)
            ? (rng() < 0.72 ? "AT7" : "L4T")
            : yon === "MVL" && (ak === "HY" || ak === "TK" || ak === "QR" || ak === "HH" || ak === "KE") && rng() < 0.32
              ? (ak === "HY" ? "788" : "332")
              : rng() < 0.55 ? "32N" : rng() < 0.8 ? "32Q" : "320";

        const ter = yon === "VVL" && prof.ter.length > 1 ? prof.ter[1] : prof.ter[0];
        const ok = !bekor && fctMin !== null && (nowUtcMin === null || fctMin <= nowUtcMin);
        let holat: FlightRec["holat"] = "kutilmoqda";
        if (bekor) holat = "bekor";
        else if (ok) holat = "bajarildi";
        else if (nowUtcMin !== null && ((estMin !== null && estMin > schMin + 15) || nowUtcMin > schMin + 15)) holat = "kechikmoqda";

        const left = Math.max(1, activeCount - activeIdx);
        let pax = 0, yuk = 0, poc = 0, bag = 0, yoq = 0;
        if (!bekor) {
          pax = activeIdx === activeCount - 1 ? remPax : Math.max(0, Math.round((remPax / left) * (0.7 + rng() * 0.6)));
          if (isCargo) pax = 0;
          pax = Math.min(remPax, pax);
          remPax -= pax;

          yuk = activeIdx === activeCount - 1 ? remYuk : Math.max(0, Math.round((remYuk / left) * (isCargo ? 3.5 : 0.7 + rng() * 0.6)));
          yuk = Math.min(remYuk, yuk);
          remYuk -= yuk;

          poc = activeIdx === activeCount - 1 ? remPoc : Math.max(0, Math.round((remPoc / left) * (0.6 + rng() * 0.8)));
          poc = Math.min(remPoc, poc);
          remPoc -= poc;

          bag = activeIdx === activeCount - 1 ? remBag : Math.max(0, Math.round((remBag / left) * (0.7 + rng() * 0.6)));
          bag = Math.min(remBag, bag);
          remBag -= bag;

          if (tt === 1) {
            yoq = activeIdx === activeCount - 1 ? remYoq : Math.max(0, Math.round((remYoq / left) * (0.7 + rng() * 0.6)));
            yoq = Math.min(remYoq, yoq);
            remYoq -= yoq;
          }
          activeIdx++;
        }

        const pf = yon === "MVL" && pax > 180 ? Math.round(pax * 0.015) : 0;
        const pc = yon !== "VVL" && pax > 60 ? Math.round(pax * (0.04 + rng() * 0.03)) : 0;
        const py = Math.max(0, pax - pf - pc);
        const inf = Math.round(pax * (0.018 + rng() * 0.008));
        const ch = Math.round(pax * (0.075 + rng() * 0.03));
        const ad = Math.max(0, pax - ch - inf);

        const kech = ok && fctMin !== null ? fctMin - schMin : (!bekor && nowUtcMin !== null ? Math.max((estMin ?? schMin) - schMin, nowUtcMin - schMin) : null);

        out.push({
          ap, tt, bosh, ak, nr, yon, st, vs, ter,
          kod: dc ? dc.kod : null,
          xiz: dc ? dc.xiz : null,
          fids: holat === "bajarildi" ? (tt === 1 ? "DEP" : "ARR") : holat === "bekor" ? "CNL" : holat === "kechikmoqda" ? "DLY" : "SCH",
          schMin, estMin, fctMin,
          sch: hmUtc(schMin),
          est: estMin !== null ? hmUtc(estMin) : null,
          fct: ok && fctMin !== null ? hmUtc(fctMin) : null,
          bekor, ok, holat,
          kech, pax, pf, pc, py, ad, ch, inf, yuk, poc, bag, yoq,
        });
      }
    };

    addDirection(1, rec.vvl_db, rec.cis_db, rec.mvl_db, rec.dbek, rec.dpax, rec.dyuk, rec.dpoc, rec.dbag, rec.dyoq, rec.ddl);
    addDirection(2, rec.vvl_ab, rec.cis_ab, rec.mvl_ab, rec.abek, rec.apax, rec.ayuk, rec.apoc, rec.abag, 0, rec.adl);
  }

  out.sort((a, b) => a.sch.localeCompare(b.sch) || a.ap.localeCompare(b.ap));
  return out;
}

// ---------------------------------------------------------------- Butun 5+ yillik ombor va kesh
type SimStore = {
  today: string;
  yesterday: string;
  days: DayApRec[];
  byDate: Map<string, Map<string, DayApRec>>;
  byMonthAp: Map<string, DayApRec[]>;
  staticPart: Record<string, any>;
  staticStamp: string;
  // tez (bugun/kecha) kesh — 5 daqiqalik tik bo'yicha yangilanadi
  liveBucket: number;
  livePart: Record<string, any>;
  liveStamp: string;
  todayFlights: FlightRec[];
  bodyJson: string;
  version: string;
};

const g = globalThis as unknown as { __simStore?: SimStore };

function generateHistoricalDays(today: string): { days: DayApRec[]; byDate: Map<string, Map<string, DayApRec>>; byMonthAp: Map<string, DayApRec[]> } {
  const days: DayApRec[] = [];
  const byDate = new Map<string, Map<string, DayApRec>>();
  const byMonthAp = new Map<string, DayApRec[]>();

  const endMs = parseUtcDay(today);
  let curMs = parseUtcDay(SIM_START);

  while (curMs <= endMs) {
    const d = new Date(curMs);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const wd = d.getUTCDay();
    const dateStr = toIsoDate(d);
    const oy = dateStr.slice(0, 7);
    const spec = specForYear(y);
    const rng = rngOf(`day:${dateStr}`);

    const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    const season = MONTH_SEASON[m - 1] * WEEKDAY_FACTOR[wd] * (0.94 + rng() * 0.12);
    const dailyFlightsTarget = (spec.flights / daysInYear) * season;
    const dailyPaxTarget = (spec.pax / daysInYear) * season;
    const dailyCargoKgTarget = ((spec.cargoT * 1000) / daysInYear) * (0.86 + rng() * 0.28);

    // Aeroport vaznlarini normallashtiramiz
    const apFltRaw: Record<string, number> = {};
    const apPaxRaw: Record<string, number> = {};
    const apCargoRaw: Record<string, number> = {};
    let fltWsum = 0, paxWsum = 0, cargoWsum = 0;

    for (const ap of AP_LIST) {
      const p = AP_PROFILES[ap];
      const fw = p.fltW(y, m);
      const pw = p.paxW(y, m);
      const cw = fw > 0 ? p.cargoW : 0;
      apFltRaw[ap] = fw; apPaxRaw[ap] = pw; apCargoRaw[ap] = cw;
      fltWsum += fw; paxWsum += pw; cargoWsum += cw;
    }

    const dayMap = new Map<string, DayApRec>();
    for (const ap of AP_LIST) {
      if (apFltRaw[ap] <= 0) continue;
      const arng = rngOf(`ap:${dateStr}:${ap}`);
      const prof = AP_PROFILES[ap];

      const fShare = apFltRaw[ap] / fltWsum;
      const pShare = apPaxRaw[ap] / paxWsum;
      const cShare = apCargoRaw[ap] / (cargoWsum || 1);

      const totF = Math.max(0, Math.round(dailyFlightsTarget * fShare * (0.92 + arng() * 0.16)));
      if (totF === 0) continue;

      const dbaj = Math.max(1, Math.round(totF * (0.49 + arng() * 0.02)));
      const abaj = Math.max(1, totF - dbaj);
      const dbek = arng() < dbaj * spec.cancel ? Math.max(1, Math.round(dbaj * spec.cancel)) : 0;
      const abek = arng() < abaj * spec.cancel ? Math.max(1, Math.round(abaj * spec.cancel)) : 0;

      const totPax = Math.max(0, Math.round(dailyPaxTarget * pShare * (0.90 + arng() * 0.20)));
      const dpax = Math.round(totPax * (0.48 + arng() * 0.04));
      const apax = Math.max(0, totPax - dpax);

      // Yo'nalish bo'yicha bo'lish
      const domRatio = prof.domShare;
      const vvl_db = Math.min(dbaj, Math.round(dbaj * domRatio));
      const vvl_ab = Math.min(abaj, Math.round(abaj * domRatio));
      const intl_db = dbaj - vvl_db;
      const intl_ab = abaj - vvl_ab;
      const cis_db = Math.round(intl_db * prof.cisShare);
      const cis_ab = Math.round(intl_ab * prof.cisShare);
      const mvl_db = intl_db - cis_db;
      const mvl_ab = intl_ab - cis_ab;

      // Ichki reyslar kichikroq samolyotlarda (o'rtacha ~68-85 yo'lovchi), xalqaro (~130-155)
      // Agar biror yo'nalishda reyslar 0 bo'lsa, yo'lovchi ham 0 bo'ladi (oylik va kunlik yig'indi 100% mos kelishi uchun)
      const domPaxShareEff = prof.domShare >= 0.99 ? 1 : Math.min(0.85, domRatio * 0.68);
      const vvl_dp = vvl_db === 0 ? 0 : intl_db === 0 ? dpax : Math.round(dpax * domPaxShareEff);
      const vvl_ap = vvl_ab === 0 ? 0 : intl_ab === 0 ? apax : Math.round(apax * domPaxShareEff);
      const intl_dp = dpax - vvl_dp;
      const intl_ap = apax - vvl_ap;
      const cis_dp = cis_db === 0 ? 0 : mvl_db === 0 ? intl_dp : Math.round(intl_dp * prof.cisShare);
      const cis_ap = cis_ab === 0 ? 0 : mvl_ab === 0 ? intl_ap : Math.round(intl_ap * prof.cisShare);
      const mvl_dp = intl_dp - cis_dp;
      const mvl_ap = intl_ap - cis_ap;

      const totCm = Math.max(0, Math.round(dailyCargoKgTarget * cShare * (0.80 + arng() * 0.40)));
      const yuk = Math.round(totCm * 0.93);
      const poc = Math.max(0, totCm - yuk);
      const dyuk = Math.round(yuk * 0.44);
      const ayuk = yuk - dyuk;
      const dpoc = Math.round(poc * 0.48);
      const apoc = poc - dpoc;

      const dbag = Math.round(dpax * (14.5 + arng() * 2.5));
      const abag = Math.round(apax * (14.5 + arng() * 2.5));
      const dyoq = Math.round((vvl_db * 4800 + (dbaj - vvl_db) * 16500) * (0.92 + arng() * 0.16));

      const winterPen = m === 12 || m === 1 || m === 2 ? -0.042 : m === 11 || m === 3 ? -0.015 : 0.01;
      const otpRate = Math.min(0.96, Math.max(0.76, spec.otp + winterPen + (arng() - 0.5) * 0.05));
      const ddl = Math.round(dbaj * (1 - otpRate));
      const dot = dbaj - ddl;
      const ddm = ddl * Math.round(34 + arng() * 24);
      const adl = Math.round(abaj * (1 - otpRate) * 0.92);
      const aot = abaj - adl;
      const adm = adl * Math.round(32 + arng() * 22);

      const rec: DayApRec = {
        kun: dateStr, oy, ap,
        dbaj, drej: dbaj, dbek, dpax, dyuk, dpoc, dbag, dyoq, dot, ddl, ddm,
        abaj, arej: abaj, abek, apax, ayuk, apoc, abag, aot, adl, adm,
        vvl_db, vvl_ab, vvl_dp, vvl_ap,
        vvl_y: Math.round((dyuk + ayuk + dpoc + apoc) * (prof.domShare >= 0.99 ? 1 : 0.04)),
        vvl_u: Math.round(dyoq * (vvl_db / dbaj) * 0.45),
        cis_db, cis_ab, cis_dp, cis_ap,
        cis_y: Math.round((dyuk + ayuk + dpoc + apoc) * prof.cisShare * 0.36),
        mvl_db, mvl_ab, mvl_dp, mvl_ap,
        mvl_y: 0,
        wl: Math.max(1, Math.round((dbaj + abaj) * (0.94 + arng() * 0.05))),
      };
      rec.mvl_y = Math.max(0, dyuk + ayuk + dpoc + apoc - rec.vvl_y - rec.cis_y);

      days.push(rec);
      dayMap.set(ap, rec);
      const maKey = `${oy}|${ap}`;
      const arr = byMonthAp.get(maKey);
      if (arr) arr.push(rec);
      else byMonthAp.set(maKey, [rec]);
    }
    byDate.set(dateStr, dayMap);
    curMs += DAY_MS;
  }

  return { days, byDate, byMonthAp };
}

// Aviakompaniya / Yo'nalish / Kechikish taqsimot yordamchilari
function airlineWeightsFor(ap: string, yStart: number, yEnd: number) {
  const yMid = Math.round((yStart + yEnd) / 2);
  const prof = AP_PROFILES[ap];
  const out: { ak: string; w: number; cargoW: number; domW: number }[] = [];
  for (const [ak, info] of Object.entries(AIRLINES)) {
    if (info.since && yEnd < info.since) continue;
    let w = info.baseW;
    if (info.since && yStart < info.since) {
      w *= Math.max(0.2, (yEnd - info.since + 1) / (yEnd - yStart + 1));
    }
    if (ak === "9S" && ap === "SKD") w *= 3.6;
    if (ak === "US" && prof && prof.domShare > 0.5) w *= 2.8;
    if (prof && prof.domShare >= 0.99 && !info.dom) continue;
    if (ak === "C6" && yMid >= 2025) w *= 1.18;
    out.push({ ak, w, cargoW: info.cargo ? w * 3.5 : w * 0.35, domW: info.dom ? w : 0 });
  }
  const sumW = out.reduce((s, x) => s + x.w, 0) || 1;
  return out.map((x) => ({ ...x, share: x.w / sumW }));
}

function destWeightsFor(ap: string) {
  const prof = AP_PROFILES[ap];
  const domPool = AP_LIST.filter((c) => c !== ap && (ap === "TAS" || c === "TAS" || AP_PROFILES[c].paxW(2025, 6) > 0.02));
  const intlPool = Object.entries(DESTS);
  const list: { k: string; yon: "VVL" | "CIS" | "MVL"; w: number; pw: number }[] = [];

  if (prof.domShare > 0) {
    const domBase = prof.domShare * 100;
    const domPaxBase = (prof.domShare >= 0.99 ? 1 : Math.min(0.85, prof.domShare * 0.68)) * 100;
    const rawW = domPool.map((c, i) => (c === "TAS" ? 55 : Math.max(1, 20 - i * 1.4)));
    const rawSum = rawW.reduce((s, x) => s + x, 0) || 1;
    domPool.forEach((c, i) => {
      const f = rawW[i] / rawSum;
      list.push({ k: c, yon: "VVL", w: domBase * f, pw: domPaxBase * f });
    });
  }
  if (prof.domShare < 1) {
    const intlBase = (1 - prof.domShare) * 100;
    const intlPaxBase = (1 - (prof.domShare >= 0.99 ? 1 : Math.min(0.85, prof.domShare * 0.68))) * 100;
    const cisTot = intlPool.filter(([, d]) => d.yon === "CIS").reduce((s, [, d]) => s + d.w, 0) || 1;
    const mvlTot = intlPool.filter(([, d]) => d.yon === "MVL").reduce((s, [, d]) => s + d.w, 0) || 1;
    for (const [k, d] of intlPool) {
      if (d.yon === "CIS") {
        const f = prof.cisShare * (d.w / cisTot);
        list.push({ k, yon: "CIS", w: intlBase * f, pw: intlPaxBase * f });
      } else {
        const f = (1 - prof.cisShare) * (d.w / mvlTot);
        list.push({ k, yon: "MVL", w: intlBase * f, pw: intlPaxBase * f });
      }
    }
  }
  const sumW = list.reduce((s, x) => s + x.w, 0) || 1;
  const sumPW = list.reduce((s, x) => s + x.pw, 0) || 1;
  return list.map((x) => ({ ...x, share: x.w / sumW, paxShare: x.pw / sumPW }));
}

function buildLugat() {
  const ak: Record<string, string> = {};
  for (const [k, v] of Object.entries(AIRLINES)) ak[k] = v.name;
  const ap: Record<string, { n: string; e: string; c: string }> = {};
  for (const code of AP_LIST) ap[code] = { n: AP_NAME[code], e: AP_NAME[code], c: "Oʻzbekiston" };
  for (const [code, d] of Object.entries(DESTS)) ap[code] = { n: d.n, e: d.e, c: d.c };
  return { ak, ap, vs: AIRCRAFT_NAMES, ks: DELAY_SERVICES };
}

function buildStaticParts(today: string, yesterday: string, days: DayApRec[], byDate: Map<string, Map<string, DayApRec>>, byMonthAp: Map<string, DayApRec[]>) {
  const yb = today.slice(0, 4) + "-01-01";
  const prevYb = (+today.slice(0, 4) - 1) + "-01-01";
  const prevToday = (+today.slice(0, 4) - 1) + today.slice(4);
  const d30Start = addDaysStr(today, -30);
  const d60Start = addDaysStr(today, -60);
  const d120Start = addDaysStr(today, -120);

  // 1. oylik (2021-01 .. bugungi oy)
  const oylikMap = new Map<string, any>();
  const addOylik = (oy: string, ap: string, tt: 1 | 2, yon: string, rej: number, bek: number, baj: number, k15: number, kd: number, pax: number, yuk: number, poc: number, bag: number) => {
    if (rej === 0 && baj === 0 && bek === 0 && pax === 0) return;
    const key = `${oy}|${ap}|${tt}|${yon}`;
    let o = oylikMap.get(key);
    if (!o) { o = { oy, ap, tt, yon, rej: 0, bek: 0, baj: 0, k15: 0, kd: 0, pax: 0, yuk: 0, poc: 0, bag: 0 }; oylikMap.set(key, o); }
    o.rej += rej; o.bek += bek; o.baj += baj; o.k15 += k15; o.kd += kd; o.pax += pax; o.yuk += yuk; o.poc += poc; o.bag += bag;
  };

  for (const r of days) {
    if (r.kun >= today) continue; // bugungi kun livePart bilan birlashadi yoki bugun oylikda kichik qo'shimcha
    const splitDir = (tt: 1 | 2, baj: number, bek: number, pax: number, yuk: number, poc: number, bag: number, k15: number, kd: number, vB: number, cB: number, mB: number, vP: number, cP: number, mP: number) => {
      const totB = Math.max(1, vB + cB + mB);
      const list: [string, number, number][] = [["VVL", vB, vP], ["CIS", cB, cP], ["MVL", mB, mP]];
      for (const [yon, b, p] of list) {
        if (b <= 0 && p <= 0) continue;
        const f = b / totB;
        addOylik(r.oy, r.ap, tt, yon, b, Math.round(bek * f), b, Math.round(k15 * f), Math.round(kd * f), p, Math.round(yuk * f), Math.round(poc * f), Math.round(bag * f));
      }
    };
    splitDir(1, r.dbaj, r.dbek, r.dpax, r.dyuk, r.dpoc, r.dbag, r.ddl, r.ddm, r.vvl_db, r.cis_db, r.mvl_db, r.vvl_dp, r.cis_dp, r.mvl_dp);
    splitDir(2, r.abaj, r.abek, r.apax, r.ayuk, r.apoc, r.abag, r.adl, r.adm, r.vvl_ab, r.cis_ab, r.mvl_ab, r.vvl_ap, r.cis_ap, r.mvl_ap);
  }
  const oylik = Array.from(oylikMap.values()).sort((a, b) => a.oy.localeCompare(b.oy) || a.ap.localeCompare(b.ap) || a.tt - b.tt || a.yon.localeCompare(b.yon));

  // 2. kunlik (oxirgi 120 kun)
  const kunlik: any[] = [];
  for (const r of days) {
    if (r.kun < d120Start || r.kun > yesterday) continue;
    kunlik.push({ kun: r.kun, ap: r.ap, tt: 1, rej: r.drej + r.dbek, bek: r.dbek, baj: r.dbaj, k15: r.ddl, pax: r.dpax, yuk: r.dyuk, poc: r.dpoc });
    kunlik.push({ kun: r.kun, ap: r.ap, tt: 2, rej: r.arej + r.abek, bek: r.abek, baj: r.abaj, k15: r.adl, pax: r.apax, yuk: r.ayuk, poc: r.apoc });
  }

  // 3. xarita_kun (5 yil barcha kunlar, kechagacha)
  const xkCols = ["kun", "ap", "f", "b", "pa", "pd", "c", "m", "g", "u", "wl", "ms", "ot", "dl", "dm", "df", "dp", "dc", "du"];
  const xkRows = days.filter((r) => r.kun <= yesterday).map((r) => [
    r.kun, r.ap, r.dbaj + r.abaj, r.dbek + r.abek, r.apax, r.dpax, r.dyuk + r.ayuk, r.dpoc + r.apoc, r.dbag + r.abag, r.dyoq,
    r.wl, r.dbaj, r.dot, r.ddl, r.ddm, r.vvl_db + r.vvl_ab, r.vvl_dp + r.vvl_ap, r.vvl_y, r.vvl_u,
  ]);
  const xarita_kun = { cols: xkCols, rows: xkRows };

  // 4. xarita_top (barcha oylar 2021-01..oy0 + prevOy~)
  const xtCols = ["oy", "ap", "t", "k", "f", "p", "c", "u"];
  const xtRows: any[][] = [];
  const oy0 = today.slice(0, 7);
  const prevOyDate = new Date(parseUtcDay(oy0 + "-01") - DAY_MS);
  const prevOy = toIsoDate(prevOyDate).slice(0, 7);
  const domCutoff = +today.slice(8, 10);

  const pushTopFor = (oyLabel: string, oyKey: string, ap: string, maxDay: number) => {
    const list = (byMonthAp.get(`${oyKey}|${ap}`) || []).filter((r) => +r.kun.slice(8, 10) <= maxDay);
    if (!list.length) return;
    const f = list.reduce((s, r) => s + r.dbaj + r.abaj, 0);
    const p = list.reduce((s, r) => s + r.dpax + r.apax, 0);
    const c = list.reduce((s, r) => s + r.dyuk + r.ayuk + r.dpoc + r.apoc, 0);
    const u = list.reduce((s, r) => s + r.dyoq, 0);
    const yr = +oyKey.slice(0, 4);

    const aks = airlineWeightsFor(ap, yr, yr).slice(0, 25);
    for (const a of aks) {
      const af = Math.max(0, Math.round(f * a.share));
      if (!af) continue;
      xtRows.push([oyLabel, ap, "ak", a.ak, af, Math.round(p * a.share), Math.round(c * a.share), Math.round(u * a.share)]);
    }
    const rts = destWeightsFor(ap).sort((a, b) => b.share - a.share).slice(0, 25);
    for (const rt of rts) {
      const rf = Math.max(0, Math.round(f * rt.share));
      if (!rf) continue;
      xtRows.push([oyLabel, ap, "r", rt.k, rf, Math.round(p * rt.paxShare), Math.round(c * rt.share), Math.round(u * rt.share)]);
    }
  };

  const allMonths = Array.from(new Set(days.map((d) => d.oy))).sort();
  for (const m of allMonths) {
    for (const ap of AP_LIST) pushTopFor(m, m, ap, 31);
  }
  for (const ap of AP_LIST) pushTopFor(prevOy + "~", prevOy, ap, domCutoff);
  const xarita_top = { cols: xtCols, rows: xtRows };

  // 5. soat_profil (oxirgi 28 kun o'rtachasi)
  const d28Start = addDaysStr(today, -28);
  const soat_profil: any[] = [];
  for (const ap of AP_LIST) {
    const sub = days.filter((r) => r.ap === ap && r.kun >= d28Start && r.kun <= yesterday);
    if (!sub.length) continue;
    const avgDep = sub.reduce((s, r) => s + r.dbaj, 0) / 28;
    const avgArr = sub.reduce((s, r) => s + r.abaj, 0) / 28;
    const depSumW = HOURLY_W_DEP.reduce((s, v) => s + v, 0);
    const arrSumW = HOURLY_W_ARR.reduce((s, v) => s + v, 0);
    for (let h = 0; h < 24; h++) {
      const od = Math.round(((avgDep * HOURLY_W_DEP[h]) / depSumW) * 100) / 100;
      const oa = Math.round(((avgArr * HOURLY_W_ARR[h]) / arrSumW) * 100) / 100;
      if (od > 0) soat_profil.push({ ap, tt: 1, s: h, o: od });
      if (oa > 0) soat_profil.push({ ap, tt: 2, s: h, o: oa });
    }
  }

  // 6. aviakompaniyalar & yonalishlar & kechikish & turlar (d30, ytd, ytdo)
  const cy = +today.slice(0, 4);
  const aviakompaniyalar: any[] = [];
  const yonalishlar: any[] = [];
  const kechikish: any[] = [];
  const turlarSt: any[] = [];
  const turlarVs: any[] = [];
  const turlarBn: any[] = [];

  for (const ap of AP_LIST) {
    const apDays = days.filter((r) => r.ap === ap && r.kun <= yesterday);
    const sumRange = (from: string, to: string) => {
      let r = 0, p = 0, k = 0, u = 0, b = 0, y = 0, dm = 0;
      for (const x of apDays) {
        if (x.kun < from || x.kun > to) continue;
        r += x.dbaj + x.abaj; p += x.dpax + x.apax; k += x.ddl; u += x.dbaj; b += x.dbek + x.abek; y += x.dyuk + x.ayuk + x.dpoc + x.apoc; dm += x.ddm;
      }
      return { r, p, k, u, b, y, dm };
    };
    const d30 = sumRange(d30Start, yesterday);
    const d30o = sumRange(d60Start, addDaysStr(d30Start, -1));
    const ytd = sumRange(yb, yesterday);
    const ytdo = sumRange(prevYb, addDaysStr(prevToday, -1));

    const aks = airlineWeightsFor(ap, cy, cy);
    for (const a of aks) {
      const info = AIRLINES[a.ak];
      const r30 = Math.round(d30.r * a.share), p30 = Math.round(d30.p * a.share);
      const rY = Math.round(ytd.r * a.share), pY = Math.round(ytd.p * a.share);
      const rYo = Math.round(ytdo.r * a.share), pYo = Math.round(ytdo.p * a.share);
      if (r30 + rY + rYo === 0) continue;

      const kFactor = Math.max(0.4, 1 - info.otpAdj * 6);
      const rpShare = info.cargo ? 0.55 : info.charter ? 0.65 : 0.94;
      const pushTp = (tp: string, f: number, paxF: number, cargoF: number) => {
        const rr30 = Math.round(r30 * f), rrY = Math.round(rY * f), rrYo = Math.round(rYo * f);
        if (rr30 + rrY + rrYo === 0) return;
        aviakompaniyalar.push({
          ap, ak: a.ak, tp,
          r_d30: rr30, p_d30: Math.round(p30 * paxF), k_d30: Math.round(d30.k * a.share * f * kFactor), u_d30: Math.round(d30.u * a.share * f), b_d30: Math.round(d30.b * a.share * f), y_d30: Math.round(d30.y * a.share * cargoF),
          r_ytd: rrY, p_ytd: Math.round(pY * paxF), k_ytd: Math.round(ytd.k * a.share * f * kFactor), u_ytd: Math.round(ytd.u * a.share * f), b_ytd: Math.round(ytd.b * a.share * f), y_ytd: Math.round(ytd.y * a.share * cargoF),
          r_ytdo: rrYo, p_ytdo: Math.round(pYo * paxF),
        });
      };
      pushTp("rp", rpShare, 0.96, 0.6);
      if (info.charter) pushTp("cp", 0.35, 0.04, 0.05);
      if (info.cargo) pushTp("rc", 0.45, 0, 0.4);
    }

    const rts = destWeightsFor(ap);
    for (const rt of rts) {
      const r30 = Math.round(d30.r * rt.share), p30 = Math.round(d30.p * rt.paxShare);
      const r30o = Math.round(d30o.r * rt.share), p30o = Math.round(d30o.p * rt.paxShare);
      const rY = Math.round(ytd.r * rt.share), pY = Math.round(ytd.p * rt.paxShare);
      const rYo = Math.round(ytdo.r * rt.share), pYo = Math.round(ytdo.p * rt.paxShare);
      if (r30 + r30o + rY + rYo === 0) continue;
      yonalishlar.push({ ap, bosh: rt.k, yon: rt.yon, r_d30: r30, p_d30: p30, r_d30o: r30o, p_d30o: p30o, r_ytd: rY, p_ytd: pY, r_ytdo: rYo, p_ytdo: pYo });
    }

    // Kechikishlar
    const dcSum = DELAY_CODES.reduce((s, d) => s + d.w, 0);
    for (const dc of DELAY_CODES) {
      const w30 = dc.w * (+today.slice(5, 7) >= 11 || +today.slice(5, 7) <= 2 ? (dc.winterBoost || 1) : 1);
      const f30 = w30 / dcSum, fY = (dc.w * (dc.winterBoost ? 1.3 : 1)) / dcSum;
      const n30 = Math.round(d30.k * f30), nY = Math.round(ytd.k * fY);
      if (n30 + nY === 0) continue;
      kechikish.push({
        ap, kod: dc.kod, xiz: dc.xiz,
        n_d30: n30, m_d30: n30 * dc.avgMin,
        n_ytd: nY, m_ytd: nY * dc.avgMin,
      });
    }

    // Turlar (st, vs, bn)
    const stDist: [string, number][] = [["J", 0.85], ["C", 0.08], ["F", 0.03], ["H", 0.015], ["N", 0.015], ["P", 0.01]];
    for (const [k, f] of stDist) {
      const v30 = Math.round(d30.r * f), vY = Math.round(ytd.r * f);
      if (v30 + vY > 0) turlarSt.push({ ap, k, d30: v30, ytd: vY });
    }
    const isDomOnly = AP_PROFILES[ap].domShare >= 0.99;
    const vsDist: [string, number][] = isDomOnly
      ? [["AT7", 0.62], ["L4T", 0.38]]
      : [["32N", 0.29], ["32Q", 0.21], ["320", 0.16], ["788", 0.09], ["73H", 0.08], ["321", 0.05], ["763", 0.04], ["AT7", 0.04], ["332", 0.02], ["76F", 0.015], ["752", 0.005]];
    for (const [k, f] of vsDist) {
      const v30 = Math.round(d30.r * f), vY = Math.round(ytd.r * f);
      if (v30 + vY > 0) turlarVs.push({ ap, k, d30: v30, ytd: vY });
    }
    if (d30.r + ytd.r > 0) {
      for (const [ak, regs] of Object.entries(REZ_REGS)) {
        if (isDomOnly && ak !== "US" && ak !== "HY") continue;
        const limit = ap === "TAS" ? regs.length : Math.min(regs.length, ap === "SKD" ? 12 : 6);
        for (let i = 0; i < limit; i++) {
          const item = regs[i];
          if (isDomOnly && item.vs !== "AT7" && item.vs !== "L4T") continue;
          const cnt30 = Math.max(1, Math.round((d30.r / (regs.length * 4)) * (1 - i * 0.02)));
          const cntY = Math.max(cnt30, Math.round((ytd.r / (regs.length * 4)) * (1 - i * 0.02)));
          turlarBn.push({ ap, ak, k: item.reg, d30: cnt30, ytd: cntY });
        }
      }
    }
  }

  // Hafta va yil oldin (bugun.sql ning hafta va yil qatorlari)
  void byDate;

  return {
    oylik,
    kunlik,
    xarita_kun,
    xarita_top,
    soat_profil,
    aviakompaniyalar,
    yonalishlar,
    kechikish,
    turlar: { st: turlarSt, vs: turlarVs, bn: turlarBn },
    lugat: buildLugat(),
  };
}

function buildLiveParts(today: string, yesterday: string, nowUtcMin: number, byDate: Map<string, Map<string, DayApRec>>) {
  const todayMap = byDate.get(today) || new Map<string, DayApRec>();
  const yestMap = byDate.get(yesterday) || new Map<string, DayApRec>();
  const weekMap = byDate.get(addDaysStr(today, -7)) || new Map<string, DayApRec>();
  const yearMap = byDate.get(addDaysStr(today, -364)) || new Map<string, DayApRec>();

  const todayFlights = buildDayFlights(today, todayMap, nowUtcMin);
  const yestFlights = buildDayFlights(yesterday, yestMap, null);

  // bugun.sql
  const bugun: any[] = [];
  const aggFlights = (k: string, flts: FlightRec[], ap: string, tt: 1 | 2) => {
    const sub = flts.filter((f) => f.ap === ap && f.tt === tt);
    if (!sub.length) return;
    let rej = 0, bek = 0, baj = 0, k15 = 0, kd = 0, pax = 0, yuk = 0, poc = 0, bag = 0, hz_baj = 0, hz_pax = 0;
    for (const f of sub) {
      if (f.bekor) { bek++; continue; }
      rej++;
      if (f.ok) {
        baj++;
        const d = (f.fctMin ?? 0) - f.schMin;
        if (d > 15) { k15++; if (d < 1440) kd += d; }
        pax += f.pax; yuk += f.yuk; poc += f.poc; bag += f.bag;
        if ((f.fctMin ?? 9999) <= nowUtcMin) { hz_baj++; hz_pax += f.pax; }
      }
    }
    bugun.push({ k, ap, tt, rej, bek, baj, k15, kd, pax, yuk, poc, bag, hz_baj, hz_pax });
  };
  for (const ap of AP_LIST) {
    for (const tt of [1, 2] as const) {
      aggFlights("bugun", todayFlights, ap, tt);
      aggFlights("kecha", yestFlights, ap, tt);
      const addHist = (k: "hafta" | "yil", m: Map<string, DayApRec>) => {
        const r = m.get(ap);
        if (!r) return;
        const frac = Math.min(1, Math.max(0.05, nowUtcMin / 1440));
        if (tt === 1) bugun.push({ k, ap, tt, rej: r.drej, bek: r.dbek, baj: r.dbaj, k15: r.ddl, kd: r.ddm, pax: r.dpax, yuk: r.dyuk, poc: r.dpoc, bag: r.dbag, hz_baj: Math.round(r.dbaj * frac), hz_pax: Math.round(r.dpax * frac) });
        else bugun.push({ k, ap, tt, rej: r.arej, bek: r.abek, baj: r.abaj, k15: r.adl, kd: r.adm, pax: r.apax, yuk: r.ayuk, poc: r.apoc, bag: r.abag, hz_baj: Math.round(r.abaj * frac), hz_pax: Math.round(r.apax * frac) });
      };
      addHist("hafta", weekMap);
      addHist("yil", yearMap);
    }
  }

  // soatlik.sql
  const soatlik: any[] = [];
  const pushHr = (k: string, flts: FlightRec[]) => {
    const m = new Map<string, { rej: number; bek: number; baj: number }>();
    for (const f of flts) {
      const s = Math.floor(f.schMin / 60);
      const key = `${f.ap}|${f.tt}|${s}`;
      const o = m.get(key) || { rej: 0, bek: 0, baj: 0 };
      o.rej++; if (f.bekor) o.bek++; if (f.ok) o.baj++;
      m.set(key, o);
    }
    for (const [key, o] of m) {
      const [ap, tt, s] = key.split("|");
      soatlik.push({ k, ap, tt: +tt, s: +s, ...o });
    }
  };
  pushHr("bugun", todayFlights);
  pushHr("kecha", yestFlights);

  // tablo.sql
  const tablo = todayFlights.map((f) => ({
    ap: f.ap, tt: f.tt, bosh: f.bosh, ak: f.ak, nr: f.nr, yon: f.yon, st: f.st, vs: f.vs, ter: f.ter,
    kod: f.kod, xiz: f.xiz, fids: f.fids, sch: f.sch, est: f.est, fct: f.fct, holat: f.holat, kech: f.kech, pax: f.pax,
  }));

  // xarita_bugun.sql va kecha.sql
  const cols = ["kun", "ap", "f", "b", "pa", "pd", "c", "m", "g", "u", "wl", "ms", "ot", "dl", "dm", "df", "dp", "dc", "du"];
  const mapRows = (kunStr: string, flts: FlightRec[], cutoffMin: number) => {
    const rows: any[][] = [];
    for (const ap of AP_LIST) {
      const sub = flts.filter((f) => f.ap === ap);
      if (!sub.length) continue;
      let f = 0, b = 0, pa = 0, pd = 0, c = 0, m = 0, g = 0, u = 0, wl = 0, ms = 0, ot = 0, dl = 0, dm = 0, df = 0, dp = 0, dc = 0, du = 0;
      for (const fl of sub) {
        if (fl.bekor && fl.schMin <= cutoffMin) b++;
        const okCut = !fl.bekor && fl.fctMin !== null && fl.fctMin <= cutoffMin;
        if (!okCut) continue;
        f++; wl++;
        if (fl.tt === 2) pa += fl.pax; else pd += fl.pax;
        c += fl.yuk; m += fl.poc; g += fl.bag; u += fl.yoq;
        if (fl.tt === 1) {
          ms++;
          const d = (fl.fctMin ?? 0) - fl.schMin;
          if (d <= 15) ot++; else { dl++; if (d < 1440) dm += d; }
        }
        if (fl.yon === "VVL") { df++; dp += fl.pax; dc += fl.yuk + fl.poc; du += fl.yoq; }
      }
      rows.push([kunStr, ap, f, b, pa, pd, c, m, g, u, wl, ms, ot, dl, dm, df, dp, dc, du]);
    }
    return rows;
  };
  const xarita_bugun = { cols, rows: mapRows(today, todayFlights, nowUtcMin) };
  const kecha = { cols, rows: mapRows(yesterday, yestFlights, nowUtcMin), gacha: hmUtc(nowUtcMin), bugun: today };

  // sutka.sql
  const sideStats = (tt: 1 | 2) => {
    let rej = 0, bek = 0, baj = 0, kech = 0, pax = 0, pf = 0, pc = 0, py = 0, ad = 0, ch = 0, inf = 0, yuk = 0, vvl = 0, xal = 0;
    for (const f of todayFlights) {
      if (f.tt !== tt) continue;
      if (f.bekor) { bek++; continue; }
      rej++;
      if (f.ok) baj++;
      if (f.kod) kech++;
      pax += f.pax; pf += f.pf; pc += f.pc; py += f.py; ad += f.ad; ch += f.ch; inf += f.inf;
      yuk += f.yuk + f.poc;
      if (f.yon === "VVL") vvl++; else xal++;
    }
    return { rej, bek, baj, kech, pax, pf, pc, py, ad, ch, inf, yuk, vvl, xal };
  };
  const topCnt = (tt: 1 | 2, keyFn: (f: FlightRec) => string | null) => {
    const m: Record<string, number> = {};
    for (const f of todayFlights) {
      if (f.tt !== tt || f.bekor) continue;
      const k = keyFn(f);
      if (k) m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k)).slice(0, 10);
  };
  const sutka = {
    bugun: today,
    hozir: hmUtc(nowUtcMin),
    dep: sideStats(1),
    arr: sideStats(2),
    davlat: {
      dep: topCnt(1, (f) => DESTS[f.bosh]?.ruC || null),
      arr: topCnt(2, (f) => DESTS[f.bosh]?.ruC || null),
    },
    ak: {
      dep: topCnt(1, (f) => f.ak),
      arr: topCnt(2, (f) => f.ak),
    },
    yon: {
      dep: topCnt(1, (f) => (f.bosh !== "TAS" ? f.bosh : null)),
      arr: topCnt(2, (f) => (f.bosh !== "TAS" ? f.bosh : null)),
    },
  };

  return { bugun, kecha, soatlik, sutka, tablo, xarita_bugun, todayFlights };
}

function ensureStore(): SimStore {
  const now = new Date();
  const today = toIsoDate(now);
  const nowUtcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const bucket = Math.floor(Date.now() / (5 * 60_000));

  if (!g.__simStore || g.__simStore.today !== today) {
    const yesterday = addDaysStr(today, -1);
    const { days, byDate, byMonthAp } = generateHistoricalDays(today);
    const staticPart = buildStaticParts(today, yesterday, days, byDate, byMonthAp);
    const staticStamp = stampLocal(Date.now());
    const live = buildLiveParts(today, yesterday, nowUtcMin, byDate);
    const liveStamp = stampLocal(Date.now());
    const version = `${today}:${bucket}`;

    const full: Record<string, any> = {
      ...staticPart,
      bugun: live.bugun,
      kecha: live.kecha,
      soatlik: live.soatlik,
      sutka: live.sutka,
      tablo: live.tablo,
      xarita_bugun: live.xarita_bugun,
    };
    const qismlar: Record<string, string> = {};
    for (const k of Object.keys(full)) qismlar[k] = ["bugun", "kecha", "soatlik", "sutka", "tablo", "xarita_bugun"].includes(k) ? liveStamp : staticStamp;
    full.meta = { yaratildi: liveStamp, v: version, xatolar: [], demo: true, qismlar };

    g.__simStore = {
      today, yesterday, days, byDate, byMonthAp,
      staticPart, staticStamp,
      liveBucket: bucket,
      livePart: { bugun: live.bugun, kecha: live.kecha, soatlik: live.soatlik, sutka: live.sutka, tablo: live.tablo, xarita_bugun: live.xarita_bugun },
      liveStamp,
      todayFlights: live.todayFlights,
      bodyJson: JSON.stringify(full),
      version,
    };
  } else if (g.__simStore.liveBucket !== bucket) {
    const st = g.__simStore;
    const live = buildLiveParts(st.today, st.yesterday, nowUtcMin, st.byDate);
    const liveStamp = stampLocal(Date.now());
    const version = `${st.today}:${bucket}`;
    const full: Record<string, any> = {
      ...st.staticPart,
      bugun: live.bugun,
      kecha: live.kecha,
      soatlik: live.soatlik,
      sutka: live.sutka,
      tablo: live.tablo,
      xarita_bugun: live.xarita_bugun,
    };
    const qismlar: Record<string, string> = {};
    for (const k of Object.keys(full)) qismlar[k] = ["bugun", "kecha", "soatlik", "sutka", "tablo", "xarita_bugun"].includes(k) ? liveStamp : st.staticStamp;
    full.meta = { yaratildi: liveStamp, v: version, xatolar: [], demo: true, qismlar };
    st.liveBucket = bucket;
    st.livePart = { bugun: live.bugun, kecha: live.kecha, soatlik: live.soatlik, sutka: live.sutka, tablo: live.tablo, xarita_bugun: live.xarita_bugun };
    st.liveStamp = liveStamp;
    st.todayFlights = live.todayFlights;
    st.bodyJson = JSON.stringify(full);
    st.version = version;
  }

  return g.__simStore;
}

export function warmSim() {
  ensureStore();
}

export function simDataVersion(): string {
  return ensureStore().version;
}

export function getSimData(): string {
  return ensureStore().bodyJson;
}

export function simHealthInfo() {
  const st = ensureStore();
  return {
    ok: true,
    mode: "simulation",
    configured: false,
    schedulerRunning: false,
    uptimeSec: Math.round(process.uptime()),
    daysCount: st.days.length,
    range: `${SIM_START}..${st.today}`,
    version: st.version,
  };
}

// ---------------------------------------------------------------- /api/stat immitatsiyasi (istalgan davr + aeroport)
export function getSimStat(from: string, to: string, cfrom: string, cto: string, ap: string) {
  const st = ensureStore();
  const isAll = ap === "ALL";
  const now = new Date();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  type PerAgg = {
    rej: number; baj: number; bek: number; pax: number; pax_dep: number; pax_arr: number;
    yuk: number; poc: number; bag: number; yoq: number; ms: number; ot: number; dl: number; dm: number;
    ichki: number; xalqaro: number;
    kunlar: [string, number, number, number][];
    byAp: Record<string, { baj: number; pax: number }>;
    ySum: number; yCnt: number;
  };

  const scan = (f0: string, f1: string): PerAgg | null => {
    let rej = 0, baj = 0, bek = 0, pax = 0, pax_dep = 0, pax_arr = 0, yuk = 0, poc = 0, bag = 0, yoq = 0;
    let ms = 0, ot = 0, dl = 0, dm = 0, ichki = 0, xalqaro = 0;
    const kunMap = new Map<string, { baj: number; pax: number; yk: number }>();
    const byAp: Record<string, { baj: number; pax: number }> = {};
    let ySum = 0, yCnt = 0;

    // 1. Tarixiy kunlar (bugundan oldin)
    for (const r of st.days) {
      if (r.kun < f0 || r.kun > f1 || r.kun >= st.today) continue;
      if (!isAll && r.ap !== ap) continue;
      const dBaj = r.dbaj + r.abaj;
      const dRej = r.drej + r.arej;
      const dBek = r.dbek + r.abek;
      const dPaxD = r.dpax, dPaxA = r.apax, dPax = dPaxD + dPaxA;
      const dYuk = r.dyuk + r.ayuk, dPoc = r.dpoc + r.apoc, dBag = r.dbag + r.abag;
      const dIchki = r.vvl_db + r.vvl_ab;

      rej += dRej; baj += dBaj; bek += dBek;
      pax += dPax; pax_dep += dPaxD; pax_arr += dPaxA;
      yuk += dYuk; poc += dPoc; bag += dBag; yoq += r.dyoq;
      ms += r.dbaj; ot += r.dot; dl += r.ddl; dm += r.ddm;
      ichki += dIchki; xalqaro += dBaj - dIchki;
      ySum += +r.kun.slice(0, 4); yCnt++;

      const k = kunMap.get(r.kun) || { baj: 0, pax: 0, yk: 0 };
      k.baj += dBaj; k.pax += dPax; k.yk += dYuk + dPoc;
      kunMap.set(r.kun, k);

      const apAcc = byAp[r.ap] || { baj: 0, pax: 0 };
      apAcc.baj += dBaj; apAcc.pax += dPax;
      byAp[r.ap] = apAcc;
    }

    // 2. Bugungi kun (agar oraliq bugunni qamrab olsa)
    if (f0 <= st.today && f1 >= st.today) {
      const k = kunMap.get(st.today) || { baj: 0, pax: 0, yk: 0 };
      for (const fl of st.todayFlights) {
        if (!isAll && fl.ap !== ap) continue;
        if (fl.bekor) { bek++; continue; }
        rej++; pax += fl.pax;
        if (fl.tt === 1) pax_dep += fl.pax; else pax_arr += fl.pax;
        k.pax += fl.pax;
        const apAcc = byAp[fl.ap] || { baj: 0, pax: 0 };
        apAcc.pax += fl.pax;

        if (fl.ok) {
          baj++; yuk += fl.yuk; poc += fl.poc; bag += fl.bag; yoq += fl.yoq;
          k.baj++; k.yk += fl.yuk + fl.poc;
          apAcc.baj++;
          if (fl.yon === "VVL") ichki++; else xalqaro++;
          if (fl.tt === 1) {
            ms++;
            const d = (fl.fctMin ?? 0) - fl.schMin;
            if (d <= 15) ot++; else { dl++; if (d < 1440) dm += d; }
          }
        }
        byAp[fl.ap] = apAcc;
      }
      if (k.baj > 0 || k.pax > 0) kunMap.set(st.today, k);
      ySum += +st.today.slice(0, 4); yCnt++;
    }

    if (rej === 0 && baj === 0 && bek === 0) return null;
    const kunlar = Array.from(kunMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([kun, v]): [string, number, number, number] => [kun, v.baj, v.pax, v.yk]);

    return { rej, baj, bek, pax, pax_dep, pax_arr, yuk, poc, bag, yoq, ms, ot, dl, dm, ichki, xalqaro, kunlar, byAp, ySum, yCnt };
  };

  const A = scan(from, to);
  const B = scan(cfrom, cto);

  const pickMeta = (agg: PerAgg | null, f0: string, f1: string) => {
    const yStart = +f0.slice(0, 4), yEnd = +f1.slice(0, 4);
    const akMap: Record<string, { baj: number; pax: number }> = {};
    const yonMap: Record<string, { baj: number; pax: number }> = {};
    if (!agg) return { akMap, yonMap };

    for (const [apCode, vals] of Object.entries(agg.byAp)) {
      for (const a of airlineWeightsFor(apCode, yStart, yEnd)) {
        const o = akMap[a.ak] || { baj: 0, pax: 0 };
        o.baj += vals.baj * a.share;
        o.pax += vals.pax * a.share;
        akMap[a.ak] = o;
      }
      for (const rt of destWeightsFor(apCode)) {
        const o = yonMap[rt.k] || { baj: 0, pax: 0 };
        o.baj += vals.baj * rt.share;
        o.pax += vals.pax * rt.paxShare;
        yonMap[rt.k] = o;
      }
    }
    return { akMap, yonMap };
  };

  const mA = pickMeta(A, from, to);
  const mB = pickMeta(B, cfrom, cto);

  const akKeys = Array.from(new Set([...Object.keys(mA.akMap), ...Object.keys(mB.akMap)]));
  const ak = akKeys
    .map((k) => ({
      k,
      a_baj: Math.round(mA.akMap[k]?.baj || 0),
      b_baj: Math.round(mB.akMap[k]?.baj || 0),
      a_pax: Math.round(mA.akMap[k]?.pax || 0),
      b_pax: Math.round(mB.akMap[k]?.pax || 0),
    }))
    .sort((x, y) => Math.max(y.a_baj, y.b_baj) - Math.max(x.a_baj, x.b_baj) || x.k.localeCompare(y.k))
    .slice(0, 15);

  const yonKeys = Array.from(new Set([...Object.keys(mA.yonMap), ...Object.keys(mB.yonMap)]));
  const yon = yonKeys
    .map((k) => ({
      k,
      a_baj: Math.round(mA.yonMap[k]?.baj || 0),
      b_baj: Math.round(mB.yonMap[k]?.baj || 0),
      a_pax: Math.round(mA.yonMap[k]?.pax || 0),
      b_pax: Math.round(mB.yonMap[k]?.pax || 0),
    }))
    .sort((x, y) => Math.max(y.a_pax, y.b_pax) - Math.max(x.a_pax, x.b_pax) || x.k.localeCompare(y.k))
    .slice(0, 15);

  const apKeys = Array.from(new Set([...Object.keys(A?.byAp || {}), ...Object.keys(B?.byAp || {})]));
  const apRows = apKeys
    .map((k) => ({
      k,
      a_baj: A?.byAp[k]?.baj || 0,
      b_baj: B?.byAp[k]?.baj || 0,
      a_pax: A?.byAp[k]?.pax || 0,
      b_pax: B?.byAp[k]?.pax || 0,
    }))
    .sort((x, y) => Math.max(y.a_baj, y.b_baj) - Math.max(x.a_baj, x.b_baj) || x.k.localeCompare(y.k));

  const dcSum = DELAY_CODES.reduce((s, d) => s + d.w, 0);
  const sabab = DELAY_CODES
    .filter((d) => d.kod !== "-")
    .map((d) => ({
      k: d.kod,
      a_n: Math.round((A?.dl || 0) * (d.w / dcSum)),
      b_n: Math.round((B?.dl || 0) * (d.w / dcSum)),
    }))
    .filter((x) => x.a_n + x.b_n > 0)
    .sort((x, y) => Math.max(y.a_n, y.b_n) - Math.max(x.a_n, x.b_n))
    .slice(0, 10);

  const stripAgg = (x: PerAgg | null) =>
    x
      ? {
          rej: x.rej, baj: x.baj, bek: x.bek, pax: x.pax, pax_dep: x.pax_dep, pax_arr: x.pax_arr,
          yuk: x.yuk, poc: x.poc, bag: x.bag, yoq: x.yoq, ms: x.ms, ot: x.ot, dl: x.dl, dm: x.dm,
          ichki: x.ichki, xalqaro: x.xalqaro,
        }
      : null;

  return {
    a: stripAgg(A),
    b: stripAgg(B),
    kunlar: { a: A?.kunlar || [], b: B?.kunlar || [] },
    ak,
    yon,
    ap: apRows,
    sabab,
    hozir: `${st.today} ${hmUtc(nowMin)}`,
  };
}
