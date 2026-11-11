import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import "./landing.css";

export const metadata: Metadata = {
  title: "Calculadora iFood · Domma Food | Preço certo no delivery, sem prejuízo",
  description: "Descubra em segundos quanto cobrar em cada item no iFood, Keeta, 99Food e aiqfome para receber limpo o preço do balcão. Taxas sempre atualizadas pela Domma Food.",
  openGraph: {
    title: "Venda no iFood sem pagar a taxa do seu bolso",
    description: "A calculadora que mostra o preço certo de cada item nos 4 apps de delivery. Taxas 2026 atualizadas.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function Page() {
  return <Landing />;
}
