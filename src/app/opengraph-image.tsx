import { ImageResponse } from "next/og";

import { brand } from "@/design-system/brand";

export const alt = `${brand.name} — ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static card drawn from the brand tokens (turquoise, credential-style frame). No remote fonts or data: it renders at build time.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b1118", padding: 72, color: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg height="96" viewBox="0 0 32 32" width="96" xmlns="http://www.w3.org/2000/svg">
            <rect fill="#0f7d97" height="32" rx="9" width="32" />
            <path d="M21.2 11.4c-1.1-1.5-2.9-2.4-5-2.4-2.9 0-5.1 1.5-5.1 3.7 0 5.5 10.1 2.5 10.1 8 0 2.3-2.2 3.8-5.1 3.8-2.3 0-4.2-1-5.3-2.7" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
            <circle cx="23.5" cy="8.5" fill="#7fe3f5" r="2" />
          </svg>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>{brand.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 940 }}>{brand.tagline}</div>
          <div style={{ fontSize: 32, color: "#9fb4c0", maxWidth: 900 }}>Técnicos verificados, cotizaciones claras y urgencias resueltas. Servicios a domicilio en Chile.</div>
        </div>
        <div style={{ display: "flex", height: 10, width: 220, background: "#0f7d97", borderRadius: 5 }} />
      </div>
    ),
    size,
  );
}
