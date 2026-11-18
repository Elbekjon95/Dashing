// Foydalanuvchi qoʻshish/parolni almashtirish:  node scripts/make-user.mjs <login> <parol>
// Chiqqan "login:salt:hash" qatorini .env.local dagi DASH_USERS ga qoʻshing (bir nechta foydalanuvchi — vergul bilan).
import { randomBytes, scryptSync } from "node:crypto";

const [user, password] = process.argv.slice(2);
if (!user || !password) {
  console.error("Foydalanish: node scripts/make-user.mjs <login> <parol>");
  process.exit(1);
}
if (password.length < 10) console.error("Ogohlantirish: parol kamida 10 belgidan iborat boʻlgani yaxshi.");
if (/[:,]/.test(user)) { console.error("Loginda ':' va ',' belgilari boʻlmasin."); process.exit(1); }
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 32).toString("hex");
console.log(`${user.toLowerCase()}:${salt}:${hash}`);
