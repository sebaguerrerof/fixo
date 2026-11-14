import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Semi_Condensed } from "next/font/google";

import "@/app/globals.css";
import { brand, brandTitle } from "@/design-system/brand";
import { themeInitScript } from "@/design-system/theme";

// Body and display are two widths of the same family (Barlow, a signage/labelling design): self-hosted by next/font at build time.
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });
const display = Barlow_Semi_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: { default: brandTitle(), template: `%s | ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  openGraph: { title: brandTitle(), description: brand.description, siteName: brand.name, locale: "es_CL", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: brand.themeColor.light }, { media: "(prefers-color-scheme: dark)", color: brand.themeColor.dark }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${body.variable} ${display.variable}`} lang={brand.locale} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
