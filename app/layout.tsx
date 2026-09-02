import type { Metadata } from "next";
import { headers } from "next/headers";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ogImage = `${protocol}://${host}/og.png`;
  return {
    title: "Horus — Controle de horas técnicas",
    description: "Controle de horas, fechamento mensal, solicitações e banco de horas para colaboradores.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "Horus — Horas técnicas sob controle", description: "Acompanhe lançamentos, saldos e prazos em um único extrato confiável.", images: [{ url: ogImage, width: 1728, height: 912, alt: "Horus — horas técnicas sob controle" }] },
    twitter: { card: "summary_large_image", title: "Horus — Horas técnicas sob controle", description: "Lançamentos, saldos e prazos em um único extrato confiável.", images: [ogImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${manrope.variable} ${sora.variable}`}>{children}</body></html>;
}
