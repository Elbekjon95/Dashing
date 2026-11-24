// Server ishga tushganda bir marta chaqiriladi: baza sozlangan boʻlsa yangilagichni, aks holda immitatsiya keshini boshlaydi.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { dbConfigured, startScheduler } = await import("./lib/db");
    if (dbConfigured()) {
      startScheduler();
    } else {
      const { warmSim } = await import("./lib/sim");
      warmSim();
    }
  }
}
