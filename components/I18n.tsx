"use client";
import { useEffect, useSyncExternalStore } from "react";
import { DomTranslator, LANGS, LANG_EVENT, currentLang, setLang, type Lang } from "@/lib/i18n";

const subscribe = (cb: () => void) => {
  window.addEventListener(LANG_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(LANG_EVENT, cb); window.removeEventListener("storage", cb); };
};
export const useLang = (): Lang => useSyncExternalStore(subscribe, currentLang, () => "uz" as Lang);

// Sahifa matnlarini tanlangan tilga tarjima qiladi (layout ichida bir marta ulanadi).
export default function I18nRoot() {
  const lang = useLang();
  useEffect(() => {
    const tr = new DomTranslator();
    // gidratatsiya tugashini kutamiz, shundan keyin matnlarni almashtiramiz
    const id = setTimeout(() => tr.start(lang), 250);
    return () => { clearTimeout(id); tr.stop(true); };
  }, [lang]);
  return null;
}

// UZ | RU | EN tanlagich
export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang();
  return (
    <div className={"langsw" + (className ? " " + className : "")} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.id} type="button" className={l.id === lang ? "on" : ""} title={l.name} onClick={() => setLang(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}
