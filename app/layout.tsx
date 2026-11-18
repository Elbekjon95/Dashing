import type { Metadata } from "next";
import I18nRoot from "@/components/I18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Situation Dashboard",
  description: "Oʻzbekiston aeroportlari — situation dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        {children}
        <I18nRoot />
      </body>
    </html>
  );
}