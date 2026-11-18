# Serverga qo'yish (doimiy ishlashi uchun)

## 1. Talablar
- Node.js 20+ (hozirgi loyiha Node 26 da sinalgan), serverdan PostgreSQL bazasiga tarmoq orqali ulanish.
- Baza foydalanuvchisi **faqat o'qish** huquqiga ega bo'lishi tavsiya etiladi (dastur o'zi ham sessiyani faqat-o'qish rejimida ochadi).

## 2. Sozlash — `.env.local`
```
PGHOST=...  PGPORT=5432  PGDATABASE=...  PGUSER=...  PGPASSWORD=...   (yoki PGPASSWORD_BASE64)
DASH_TEZ_DAQIQA=5       # bugungi ko'rsatkichlar bazadan har 5 daqiqada
DASH_SEKIN_DAQIQA=30    # tarixiy tahlillar (oylik, kechikish, aviakompaniya, yo'nalish) har 30 daqiqada
```
Fayl o'zgarsa, serverni qayta ishga tushiring.

## 2a. Avtorizatsiya (majburiy)
Dashboard faqat login/parol bilan ochiladi. Sozlanmagan bo'lsa — hech kim kira olmaydi.
```
DASH_USERS=admin:<salt>:<hash>,boshqa:<salt>:<hash>
DASH_SESSION_SECRET=<kamida 32 belgili tasodifiy matn>
```
- Foydalanuvchi qo'shish / parolni almashtirish: `node scripts/make-user.mjs <login> <parol>` — chiqqan `login:salt:hash` qatorini `DASH_USERS` ga qo'shing (vergul bilan), serverni qayta yoqing.
- Parollar faqat scrypt xeshi ko'rinishida saqlanadi. Sessiya — imzolangan HttpOnly cookie (12 soat, «eslab qol» belgilansa 30 kun).
- 8 ta noto'g'ri urinishdan keyin shu IP 10 daqiqaga bloklanadi.
- **HTTPS orqasida** ishlatsangiz (nginx / IIS / Cloudflare), proksi `X-Forwarded-Proto: https` yuborishi kerak — shunda cookie `Secure` bo'ladi (yoki `DASH_COOKIE_SECURE=1`).
- Himoyalangan: sahifa, `/api/data`, `/api/stat`. `/api/health` kirmaganlarga faqat `{ok}` beradi.

## 2b. Til
Interfeys uch tilda: **UZ / RU / EN** (yuqori o'ng burchakdagi tanlagich; tanlov brauzerda eslab qolinadi). Yangi matn qo'shsangiz, tarjimasini `lib/i18n-dict.ts` ga qo'shing.

## 3. Ishga tushirish
```
npm ci
npm run build
```
**Variant A — pm2 (tavsiya):**
```
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```
Windows'da server yoqilganda avtomatik ishga tushishi uchun `pm2-windows-service` yoki NSSM (Windows Service) dan foydalaning.

**Variant B — pm2'siz:** `powershell -ExecutionPolicy Bypass -File .\start-prod.ps1`  
(uzilsa 5 soniyadan keyin o'zi qayta yoqadi; log: `logs/server.log`).

Manzil: `http://<server>:3000`. Televizor rejimi: `http://<server>:3000/#tv`.

## 4. Nima uchun muammosiz ishlaydi
- **Orqa fon yangilagichi:** server ishga tushganda bazadan ma'lumot yig'ishni o'zi boshlaydi va davomli yangilab turadi — sahifani hech kim ochmagan bo'lsa ham.
- **Xatoga chidamlilik:** baza vaqtincha ishlamasa yoki sekinlashsa, oxirgi yaxshi ma'lumot ko'rsatilib turadi (sahifada ogohlantirish chiqadi); ulanish uzilsa, avtomatik qayta uriniladi.
- **Yengil trafik:** brauzer har daqiqada faqat "o'zgarish bormi?" deb so'raydi; yangi ma'lumot bo'lsa ham to'liq yuklanadi va kartalar atrofida porlash effekti chiqadi.
- **Bazaga yuk:** bir vaqtda ko'pi bilan 3 ta so'rov; maxsus davr statistikasi (`/api/stat`) 5 daqiqa keshlanadi, davr uzunligi ≤ 400 kun.

## 5. Monitoring
`GET /api/health` — `200` bo'lsa hammasi joyida; `503` bo'lsa baza ulanmagan yoki bugungi ma'lumot 15 daqiqadan ko'p eskirgan.  
Javobda har bir so'rovning yoshi (`ageSec`), davomiyligi (`ms`) va xatosi ko'rinadi.

## 6. Kun va vaqt qoidasi
Bugungi va barcha hisoblar **UTC kuni** bo'yicha, `planned` ustuni asosida (rahbariyatning Grafana dashboardi bilan bir xil).
