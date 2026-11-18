// Parolni tiklash (admin parolini unutganda) yoki buyruq qatoridan foydalanuvchi qoʻshish:
//   node scripts/make-user.mjs <login> <parol>
// Foydalanuvchi bor boʻlsa — paroli almashadi (roli saqlanadi); yoʻq boʻlsa — ADMIN sifatida qoʻshiladi.
// Fayl: DASH_USERS_FILE yoki <loyiha>/data/users.json (lib/users.ts bilan bir xil). Server qayta ishga tushirilmaydi.
import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const [rawUser, password] = process.argv.slice(2);
if (!rawUser || !password) {
  console.error("Foydalanish: node scripts/make-user.mjs <login> <parol>");
  process.exit(1);
}
const user = rawUser.trim().toLowerCase();
if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(user)) { console.error("Login 3–32 belgi: kichik lotin harflari, raqamlar, nuqta, chiziq."); process.exit(1); }
if (password.length < 10) { console.error("Parol kamida 10 belgidan iborat boʻlsin."); process.exit(1); }

const file = (process.env.DASH_USERS_FILE || "").trim() || path.join(process.cwd(), "data", "users.json");
let users = [];
try { users = JSON.parse(readFileSync(file, "utf8")).users ?? []; }
catch (e) { if (e.code !== "ENOENT") { console.error("users.json oʻqib boʻlmadi:", e.message); process.exit(1); } }

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 32).toString("hex");
const i = users.findIndex((u) => u.username === user);
if (i >= 0) users[i] = { ...users[i], salt, hash };
else users.push({ username: user, salt, hash, role: "admin", createdAt: new Date().toISOString() });

mkdirSync(path.dirname(file), { recursive: true });
const tmp = file + "." + process.pid + ".tmp";
writeFileSync(tmp, JSON.stringify({ users }, null, 2), { mode: 0o600 });
renameSync(tmp, file);
console.log(i >= 0 ? `«${user}» paroli almashtirildi.` : `«${user}» administrator sifatida qoʻshildi.`, "(" + file + ")");
