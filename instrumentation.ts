// Server ishga tushganda bir marta chaqiriladi: bazadan maʼlumotni orqa fonda yangilab turishni boshlaydi
// (hech kim sahifani ochmagan boʻlsa ham, maʼlumot tayyor va yangi turadi).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/db");
    startScheduler();
  }
}
