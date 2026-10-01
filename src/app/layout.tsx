import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: { default: "Year Arc", template: "%s · Year Arc" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://winterarc-2026.vercel.app"),
  description: "Elige tus hábitos, márcalos en un toque y mira cómo sube tu línea de constancia. Gratis, con 1 mes de Pro.",
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Year Arc",
    title: "Year Arc · Este año es para construirte",
    description: "Elige tus hábitos, márcalos en un toque y mira cómo sube tu línea de constancia. Gratis.",
  },
  twitter: { card: "summary_large_image" },
  applicationName: "Year Arc",
  appleWebApp: { capable: true, title: "Year Arc", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  // La app privada no se indexa; la portada y las páginas públicas lo cambian en su propia metadata.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#060a12" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="es" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <Providers nonce={nonce}>{children}</Providers>
        {/* Analítica sin cookies de Vercel (visitas y páginas; sin datos personales). */}
        <Analytics />
      </body>
    </html>
  );
}
