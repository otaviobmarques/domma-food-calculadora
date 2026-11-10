import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "Calculadora iFood · Domma Food",
  description: "Preço certo no iFood, sem prejuízo. Compare iFood, Keeta, 99Food e aiqfome.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Calculadora", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#EA1D2C", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
        <SwRegister />
      </body>
    </html>
  );
}
