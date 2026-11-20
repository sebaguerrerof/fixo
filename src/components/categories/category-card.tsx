import Link from "next/link";

import type { Category } from "@/domain/entities/category";

/** A trade as a line of text: name, what it covers, how many profiles are published. No icon tile, no card chrome. */
export function CategoryCard({ category, headingLevel: Heading = "h3" }: { readonly category: Category; readonly headingLevel?: "h2" | "h3" }) {
  return (
    <Link className="motion-card group block h-full rounded-lg border border-border bg-card p-5" href={`/servicios/${category.slug}`}>
      <Heading className="text-xl">{category.name}</Heading>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{category.description}</p>
      <p className="tabular mt-4 text-sm font-semibold text-primary group-hover:underline">{category.technicianCount === 1 ? "1 perfil publicado" : `${category.technicianCount} perfiles publicados`}</p>
    </Link>
  );
}
