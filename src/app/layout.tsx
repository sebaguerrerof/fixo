import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: { default: "fixo | Técnicos de confianza", template: "%s | fixo" },
  description: "Encuentra técnicos verificados, solicita cotizaciones y resuelve urgencias con claridad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
