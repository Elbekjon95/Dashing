/* eslint-disable @typescript-eslint/no-explicit-any */
// Bazaga toʻgʻridan-toʻgʻri ulanish (faqat server tomonida).
//   sql/tez/*.sql   - har DASH_TEZ_DAQIQA (standart 5) da yangilanadi (bugungi holat)
//   sql/sekin/*.sql - har DASH_SEKIN_DAQIQA (standart 30) da yangilanadi (tarix, tahlil)
// Har bir .sql fayl bitta qator va bitta ustun (JSON) qaytaradi; natija fayl nomi ostida data obyektiga qoʻshiladi.
//
// Ishonchlilik:
//  - Yangilash ORQA FONDA, mijozlardan mustaqil ishlaydi (instrumentation.ts serverni ishga tushirganda boshlaydi).
//  - Baza ishlamasa yoki sekin boʻlsa, OXIRGI YAXSHI maʼlumot saqlanadi va koʻrsatiladi; xato meta.xatolar da koʻrinadi.
//  - Ulanish uzilsa, bir marta qayta uriniladi; uzilgan ulanish puldan chiqarib tashlanadi.
//  - Sessiya FAQAT oʻqish rejimida (xavfsizlik).
import { Pool, type PoolClient } from "pg";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const env = (k: string, d = "") => (process.env[k] ?? d).trim();

// Parol: PGPASSWORD yoki (#, \, $ kabi belgilar boʻlsa) base64 koʻrinishidagi PGPASSWORD_BASE64.
const password = () => (env("PGPASSWORD_BASE64") ? Buffer.from(env("PGPASSWORD_BASE64"), "base64").toString("utf8") : env("PGPASSWORD"));

export const dbConfigured = () => !!(env("PGHOST") && (env("PGPASSWORD") || env("PGPASSWORD_BASE64")));

const TEZ_MS = (+env("DASH_TEZ_DAQIQA", "5") || 5) * 60_000;
const SEKIN_MS = (+env("DASH_SEKIN_DAQIQA", "30") || 30) * 60_000;
const TICK_MS = 15_000; // orqa fon tekshiruvi qadami
const SQL_DIR = env("DASH_SQL_DIR") || path.join(process.cwd(), "sql");

type Kind = "tez" | "sekin";
type Part = { json: any; at: number; ms: number };
type G = {
  pool?: Pool; verified?: WeakSet<PoolClient>; store: Record<string, Part>; errors: Record<string, string>; failAt: Record<string, number>;
  pending: Map<string, Promise<void>>; body?: { key: string; text: string }; timer?: ReturnType<typeof setInterval>; startedAt: number;
};
const g = globalThis as unknown as { __dash?: G };
const S: G = (g.__dash ||= { store: {}, errors: {}, failAt: {}, pending: new Map(), startedAt: Date.now() });
S.failAt ||= {};

function getPool() {
  if (!S.pool) {
    S.pool = new Pool({
      host: env("PGHOST"),
      port: +env("PGPORT", "5432") || 5432,
      database: env("PGDATABASE"),
      user: env("PGUSER"),
      password: password(),
      max: 4,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30_000,
      keepAlive: true,
      application_name: "dash-next",
      // sessiya FAQAT oʻqish rejimida
      options: "-c default_transaction_read_only=on -c statement_timeout=90000",
    });
    S.verified = new WeakSet();
    S.pool.on("error", () => {}); // boʻsh turgan ulanish uzilsa, jarayon yiqilmasin
  }
  return S.pool;
}

function readOnlyError(sql: string): string | null {
  const s = sql.trim().replace(/;\s*$/, "").trim();
  if (!/^(select|with|show|explain|table|values)\b/i.test(s)) return "Faqat SELECT / WITH / SHOW / EXPLAIN so'rovlariga ruxsat berilgan.";
  if (s.includes(";")) return "Bir marta faqat bitta so'rov yozing (o'rtada ';' bo'lmasin).";
  return null;
}

// Bir vaqtda koʻpi bilan MAX_PARALLEL ta so'rov (qolganlari navbatda kutadi; pool navbati vaqtdan chiqib ketmasin)
const MAX_PARALLEL = 3;
let active = 0;
const waiters: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>((r) => waiters.push(r)); // joy bizga oʻtkaziladi
  else active++;
  try {
    return await fn();
  } finally {
    const next = waiters.shift();
    if (next) next();
    else active--;
  }
}

const isConnErr = (e: any) => /ECONN|ETIMEDOUT|EPIPE|terminat|Connection|57P0|08\d\d\d|socket/i.test(String(e?.code || "") + " " + String(e?.message || ""));

async function rawQuery(sql: string, params?: any[]) {
  const client = await getPool().connect();
  let bad: any;
  try {
    if (!S.verified!.has(client)) {
      const ro = await client.query("SHOW transaction_read_only");
      if (ro.rows[0]?.transaction_read_only !== "on") throw new Error("Faqat o'qish rejimini yoqib bo'lmadi - xavfsizlik uchun to'xtatildi.");
      S.verified!.add(client);
    }
    return await client.query(sql.trim().replace(/;\s*$/, ""), params);
  } catch (e) {
    if (isConnErr(e)) bad = e; // uzilgan ulanish puldan chiqariladi
    throw e;
  } finally {
    client.release(bad);
  }
}

// bitta urinish + ulanish xatosida bir marta qayta urinish
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isConnErr(e)) throw e;
    await new Promise((r) => setTimeout(r, 1500));
    return fn();
  }
}

async function runSql(sql: string) {
  const bad = readOnlyError(sql);
  if (bad) throw new Error(bad);
  return slot(() => withRetry(async () => {
    const r = await rawQuery(sql);
    if (r.rows.length !== 1) throw new Error(`So'rov bitta qator qaytarishi kerak edi, ${r.rows.length} ta qaytardi`);
    const v = Object.values(r.rows[0])[0] as any;
    return typeof v === "string" ? JSON.parse(v) : v;
  }));
}

/** Parametrli (xavfsiz) bir-qatorli JSON so'rov — maxsus davr statistikasi uchun. */
export async function runParam(sql: string, params: any[]) {
  const bad = readOnlyError(sql);
  if (bad) throw new Error(bad);
  return slot(() => withRetry(async () => {
    const r = await rawQuery(sql, params);
    if (r.rows.length !== 1) throw new Error(`So'rov bitta qator qaytarishi kerak edi, ${r.rows.length} ta qaytardi`);
    const v = Object.values(r.rows[0])[0] as any;
    return typeof v === "string" ? JSON.parse(v) : v;
  }));
}

async function listSql() {
  const out: { name: string; kind: Kind; file: string }[] = [];
  for (const kind of ["tez", "sekin"] as Kind[]) {
    const dir = path.join(/*turbopackIgnore: true*/ SQL_DIR, kind);
    const names = await readdir(/*turbopackIgnore: true*/ dir).catch(() => [] as string[]);
    for (const f of names) if (f.endsWith(".sql")) out.push({ name: f.slice(0, -4), kind, file: path.join(/*turbopackIgnore: true*/ dir, f) });
  }
  return out;
}

function refresh(f: { name: string; file: string }) {
  const hit = S.pending.get(f.name);
  if (hit) return hit;
  const p = (async () => {
    const t0 = Date.now();
    try {
      const raw = await readFile(/*turbopackIgnore: true*/ f.file, "utf8");
      const sql = raw.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join("\n");
      const json = await runSql(sql);
      S.store[f.name] = { json: json ?? null, at: Date.now(), ms: Date.now() - t0 };
      delete S.errors[f.name];
      delete S.failAt[f.name];
      console.log(`[db] OK   ${f.name.padEnd(18)} ${Date.now() - t0} ms`);
    } catch (e) {
      // eski (oxirgi yaxshi) maʼlumot saqlanib qoladi
      S.errors[f.name] = e instanceof Error ? e.message : String(e);
      S.failAt[f.name] = Date.now();
      console.error(`[db] XATO ${f.name}: ${S.errors[f.name]}`);
    } finally {
      S.pending.delete(f.name);
    }
  })();
  S.pending.set(f.name, p);
  return p;
}

const interval = (k: Kind) => (k === "tez" ? TEZ_MS : SEKIN_MS);
// xato boʻlsa, qayta urinish oraligʻi: qisqa (1 daqiqa), lekin davrdan uzun emas
const retryAfter = (k: Kind) => Math.min(60_000, interval(k));

async function tick() {
  try {
    const files = await listSql();
    const now = Date.now();
    const due = files.filter((f) => {
      const p = S.store[f.name];
      const failed = S.failAt[f.name];
      if (failed && now - failed < retryAfter(f.kind)) return false;
      return !p || now - p.at >= interval(f.kind);
    });
    // tez fayllar birinchi navbatda
    due.sort((a, b) => Number(a.kind === "sekin") - Number(b.kind === "sekin"));
    due.forEach((f) => { void refresh(f); }); // slot() parallellikni oʻzi cheklaydi
  } catch (e) {
    console.error("[db] tick xato:", e instanceof Error ? e.message : e);
  }
}

/** Orqa fonda yangilashni boshlaydi (bir marta). instrumentation.ts va birinchi soʻrovda chaqiriladi. */
export function startScheduler() {
  if (S.timer || !dbConfigured()) return;
  S.timer = setInterval(() => { void tick(); }, TICK_MS);
  S.timer.unref?.();
  void tick();
  console.log(`[db] orqa fon yangilagichi ishga tushdi: tez=${TEZ_MS / 60000} daq, sekin=${SEKIN_MS / 60000} daq`);
}

const stamp = (ms: number) => {
  const d = new Date(ms), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** Bazadan yigʻilgan data (DASH_DATA formatida), JSON matn koʻrinishida. */
export async function getDbData(): Promise<string> {
  startScheduler();
  const files = await listSql();
  if (!files.length) throw new Error(`SQL fayllar topilmadi: ${SQL_DIR}`);
  // birinchi yuklashda hamma narsani kutamiz; keyin tayyor (eski/yangi) maʼlumotni darhol beramiz
  // (lekin 25 soniyadan ortiq kutmaymiz: shu vaqtgacha kelgani bilan ishlaymiz, qolgani orqa fonda yuklanadi va keyingi soʻrovda keladi)
  const missing = files.filter((f) => !S.store[f.name]);
  if (missing.length) {
    await Promise.race([Promise.all(missing.map(refresh)), new Promise((r) => setTimeout(r, 25_000))]);
  }
  if (!Object.keys(S.store).length) throw new Error("Bazadan hech narsa olinmadi: " + (Object.values(S.errors)[0] || "ulanish kutilmoqda"));

  const key = files.map((f) => (S.store[f.name]?.at ?? 0) + (S.errors[f.name] ? "!" : "")).join("|");
  if (S.body?.key === key) return S.body.text;

  const data: Record<string, any> = {}, qismlar: Record<string, string> = {};
  let latest = 0;
  for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = S.store[f.name];
    if (!p) continue;
    data[f.name] = p.json;
    qismlar[f.name] = stamp(p.at);
    latest = Math.max(latest, p.at);
  }
  data.meta = { yaratildi: stamp(latest || Date.now()), v: key, xatolar: Object.entries(S.errors).map(([k, v]) => `${k}: ${v}`), qismlar };
  const text = JSON.stringify(data);
  S.body = { key, text };
  return text;
}

/** Joriy versiya belgisi (mijoz oʻzgarish bor-yoʻqligini kichik soʻrov bilan bilishi uchun). */
export async function dataVersion(): Promise<string | null> {
  return S.body?.key ?? null;
}

/** Sogʻliq holati: /api/health uchun. */
export function healthInfo() {
  const now = Date.now();
  const parts = Object.entries(S.store).map(([name, p]) => ({ name, ageSec: Math.round((now - p.at) / 1000), ms: p.ms, error: S.errors[name] || null }));
  const failing = Object.keys(S.errors);
  const tezStale = parts.filter((p) => !/^(aviakompaniyalar|kechikish|kunlik|lugat|oylik|soat_profil|turlar|xarita_kun|xarita_top|yonalishlar)$/.test(p.name) && p.ageSec * 1000 > TEZ_MS * 3);
  return {
    ok: dbConfigured() && Object.keys(S.store).length > 0 && tezStale.length === 0,
    configured: dbConfigured(),
    schedulerRunning: !!S.timer,
    uptimeSec: Math.round((now - S.startedAt) / 1000),
    tezMin: TEZ_MS / 60000, sekinMin: SEKIN_MS / 60000,
    pool: S.pool ? { total: S.pool.totalCount, idle: S.pool.idleCount, waiting: S.pool.waitingCount } : null,
    failing, stale: tezStale.map((p) => p.name), parts,
  };
}
