// Foydalanuvchilar ombori: JSON fayl (standart: <loyiha>/data/users.json, DASH_USERS_FILE bilan oʻzgartiriladi).
// Baza (PostgreSQL) faqat oʻqish rejimida, shuning uchun foydalanuvchilar alohida faylda saqlanadi.
// Serverga birinchi marta qoʻyilganda fayl boʻlmaydi — birinchi roʻyxatdan oʻtgan foydalanuvchi ADMIN boʻladi.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Role = "admin" | "user";
export type UserRec = { username: string; salt: string; hash: string; role: Role; createdAt: string };
export type PublicUser = { username: string; role: Role; createdAt: string };

const FILE = () => (process.env.DASH_USERS_FILE || "").trim() || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "users.json");

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const MIN_PASSWORD = 10;

export function validate(username: string, password?: string): string | null {
  if (!USERNAME_RE.test(username)) return "bad_username";
  if (password !== undefined && (password.length < MIN_PASSWORD || password.length > 256)) return "weak_password";
  return null;
}

// ---- oʻqish (fayl oʻzgarmaguncha xotirada keshlanadi)
let cache: { key: string; users: UserRec[] } | null = null;

function load(): UserRec[] {
  const file = FILE();
  let key = "none";
  try { const st = statSync(file); key = st.mtimeMs + ":" + st.size; } catch { cache = { key, users: [] }; return []; }
  if (cache && cache.key === key) return cache.users;
  let users: UserRec[] = [];
  try {
    const j = JSON.parse(readFileSync(file, "utf8"));
    if (Array.isArray(j?.users)) users = j.users.filter((u: UserRec) => u && typeof u.username === "string" && u.salt && u.hash);
  } catch (e) {
    // buzilgan faylni "boʻsh" deb qabul qilib, yangi admin yaratib yuborishga yoʻl qoʻymaymiz
    throw new Error("users.json oʻqib boʻlmadi: " + (e instanceof Error ? e.message : e));
  }
  cache = { key, users };
  return users;
}

function save(users: UserRec[]) {
  const file = FILE();
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  writeFileSync(tmp, JSON.stringify({ users }, null, 2), { mode: 0o600 });
  renameSync(tmp, file);
  cache = null;
}

// Yozuvlar bir vaqtda kelganda (masalan, ikki kishi bir paytda birinchi admin boʻlmoqchi) ketma-ket bajariladi.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => T): Promise<T> {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}

const strip = (u: UserRec): PublicUser => ({ username: u.username, role: u.role, createdAt: u.createdAt });
const find = (name: string) => load().find((u) => u.username === name.trim().toLowerCase());

export const userCount = () => load().length;
export const needsSetup = () => userCount() === 0;
export const listUsers = (): PublicUser[] => load().map(strip);
export const getUser = (name: string): PublicUser | null => { const u = find(name); return u ? strip(u) : null; };

const hashOf = (password: string, salt = randomBytes(16).toString("hex")) => ({ salt, hash: scryptSync(password, salt, 32).toString("hex") });

const DUMMY = { salt: "00".repeat(16), hash: "00".repeat(32) };
export function verifyPassword(name: string, password: string): boolean {
  const rec = find(name);
  const r = rec || DUMMY; // foydalanuvchi yoʻq boʻlsa ham bir xil vaqt sarflanadi
  const got = scryptSync(password, r.salt, 32);
  const want = Buffer.from(r.hash, "hex");
  return !!rec && got.length === want.length && timingSafeEqual(got, want);
}

export type Fail = { error: string };

/** Birinchi foydalanuvchi (ADMIN). Faqat foydalanuvchilar umuman yoʻq boʻlganda ishlaydi. */
export const createFirstAdmin = (username: string, password: string) => serial<PublicUser | Fail>(() => {
  if (load().length > 0) return { error: "already_setup" };
  const name = username.trim().toLowerCase();
  const bad = validate(name, password);
  if (bad) return { error: bad };
  const rec: UserRec = { username: name, ...hashOf(password), role: "admin", createdAt: new Date().toISOString() };
  save([rec]);
  return strip(rec);
});

export const createUser = (username: string, password: string, role: Role) => serial<PublicUser | Fail>(() => {
  const name = username.trim().toLowerCase();
  const bad = validate(name, password);
  if (bad) return { error: bad };
  const users = load();
  if (users.some((u) => u.username === name)) return { error: "exists" };
  const rec: UserRec = { username: name, ...hashOf(password), role, createdAt: new Date().toISOString() };
  save([...users, rec]);
  return strip(rec);
});

const adminsLeft = (users: UserRec[], without: string) => users.some((u) => u.role === "admin" && u.username !== without);

export const updateUser = (username: string, patch: { password?: string; role?: Role }) => serial<PublicUser | Fail>(() => {
  const name = username.trim().toLowerCase();
  const users = load();
  const i = users.findIndex((u) => u.username === name);
  if (i < 0) return { error: "not_found" };
  const next = { ...users[i] };
  if (patch.password !== undefined) {
    const bad = validate(name, patch.password);
    if (bad) return { error: bad };
    Object.assign(next, hashOf(patch.password));
  }
  if (patch.role && patch.role !== next.role) {
    if (next.role === "admin" && !adminsLeft(users, name)) return { error: "last_admin" };
    next.role = patch.role;
  }
  const copy = users.slice();
  copy[i] = next;
  save(copy);
  return strip(next);
});

export const deleteUser = (username: string) => serial<{ ok: true } | Fail>(() => {
  const name = username.trim().toLowerCase();
  const users = load();
  const u = users.find((x) => x.username === name);
  if (!u) return { error: "not_found" };
  if (u.role === "admin" && !adminsLeft(users, name)) return { error: "last_admin" };
  save(users.filter((x) => x.username !== name));
  return { ok: true };
});

/** Natija xato ekanini aniqlaydi. */
export const isFail = (r: unknown): r is Fail => !!r && typeof r === "object" && "error" in r;
