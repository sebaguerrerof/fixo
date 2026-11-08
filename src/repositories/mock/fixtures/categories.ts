import type { Category, CategoryIcon } from "@/domain/entities/category";

interface CategoryFixture extends Category {}

const definitions: readonly { id: string; slug: string; name: string; description: string; icon: CategoryIcon }[] = [
  { id: "cat-electricidad", slug: "electricidad", name: "Electricidad", description: "Instalaciones, cortocircuitos, tableros y emergencias eléctricas.", icon: "bolt" },
  { id: "cat-gasfiteria", slug: "gasfiteria", name: "Gasfitería", description: "Fugas, cañerías, calefont y artefactos sanitarios.", icon: "droplets" },
  { id: "cat-cerrajeria", slug: "cerrajeria", name: "Cerrajería", description: "Apertura de puertas, cambio de cerraduras y copias de llaves.", icon: "key-round" },
  { id: "cat-climatizacion", slug: "climatizacion", name: "Climatización y Refrigeración", description: "Aire acondicionado, calefacción y refrigeradores.", icon: "snowflake" },
  { id: "cat-computacion", slug: "computacion-y-redes", name: "Computación y Redes", description: "Redes, computadores, cámaras e instalaciones de conectividad.", icon: "monitor-cog" },
  { id: "cat-electrodomesticos", slug: "electrodomesticos", name: "Electrodomésticos", description: "Reparación de lavadoras, hornos y electrodomésticos del hogar.", icon: "wrench" },
  { id: "cat-pintura", slug: "pintura", name: "Pintura y Terminaciones", description: "Pintura interior, exterior y terminaciones menores.", icon: "paint-roller" },
  { id: "cat-jardineria", slug: "jardineria", name: "Jardinería y Áreas Verdes", description: "Mantención de jardines, poda y paisajismo.", icon: "sprout" },
];

export function buildDemoCategories(technicianCounts: ReadonlyMap<string, number>): readonly CategoryFixture[] {
  return definitions.map((category) => ({
    ...category,
    technicianCount: technicianCounts.get(category.id) ?? 0,
  }));
}

export const DEMO_CATEGORY_IDS = definitions.map((category) => category.id);
