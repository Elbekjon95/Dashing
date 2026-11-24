import { readFile, stat } from "node:fs/promises";
import { requireAuth } from "@/lib/auth";
import { dataVersion, dbConfigured, getDbData } from "@/lib/db";
import { getSimData, simDataVersion } from "@/lib/sim";

export const dynamic = "force-dynamic";

// Zaxira manba: PowerShell eksporti yozadigan fayl. .env.local ichida DASH_DATA_FILE bilan oʻzgartiriladi.
const DATA_FILE = process.env.DASH_DATA_FILE || "C:\\Users\\e.roxmonov\\Desktop\\DASH\\korxona\\data\\data.js";

let fileCache: { mtime: number; body: string } | null = null;

async function fromFile(): Promise<string> {
  const st = await stat(/*turbopackIgnore: true*/ DATA_FILE);
  if (!fileCache || fileCache.mtime !== st.mtimeMs) {
    const raw = (await readFile(/*turbopackIgnore: true*/ DATA_FILE, "utf8")).replace(/^\uFEFF/, "");
    const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("data.js formati notoʻgʻri");
    JSON.parse(raw.slice(start, end + 1)); // yaroqliligini tekshirish
    fileCache = { mtime: st.mtimeMs, body: raw.slice(start, end + 1) };
  }
  return fileCache.body;
}

const json = (body: string) => new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ?v=<versiya>: mijozdagi versiya hozirgi bilan bir xil boʻlsa, katta maʼlumotni qayta yubormaymiz (trafik tejaladi)
export async function GET(req: Request) {
  const denied = requireAuth(req); // faqat avtorizatsiyadan oʻtganlarga
  if (denied) return denied;
  const v = new URL(req.url).searchParams.get("v");
  let dbError: string | null = null;
  if (dbConfigured()) {
    try {
      const body = await getDbData();
      if (v && v === (await dataVersion())) return Response.json({ unchanged: true }, { headers: { "cache-control": "no-store" } });
      return json(body);
    } catch (e) {
      dbError = msg(e);
    }
  }
  // baza sozlanmagan yoki ishlamadi: tayyor fayldan yoki 5 yillik immitatsiya maʼlumotlaridan oʻqiymiz
  try {
    const body = await fromFile();
    if (!dbError) return json(body);
    const d = JSON.parse(body);
    d.meta = { ...(d.meta || {}), xatolar: [`ulanish: ${dbError}`, ...((d.meta && d.meta.xatolar) || [])] };
    return json(JSON.stringify(d));
  } catch {
    if (v && v === simDataVersion()) return Response.json({ unchanged: true }, { headers: { "cache-control": "no-store" } });
    return json(getSimData());
  }
}
