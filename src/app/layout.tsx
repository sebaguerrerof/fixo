import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import "@/app/globals.css";
import { brand, brandTitle } from "@/design-system/brand";
import { themeInitScript } from "@/design-system/theme";

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
    <html className={`${GeistSans.variable} ${GeistMono.variable}`} lang={brand.locale} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
