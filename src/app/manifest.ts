import type { MetadataRoute } from "next";

import { brand } from "@/design-system/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    lang: brand.locale,
    start_url: "/",
    display: "standalone",
    background_color: brand.themeColor.dark,
    theme_color: brand.themeColor.light,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
