import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

interface PaginationProps {
  readonly page: number;
  readonly total: number;
  readonly pageSize: number;
  /** Builds the href of a page, preserving the caller's other filters. */
  readonly hrefFor: (page: number) => string;
  readonly noun: string;
  readonly label?: string;
}

/** Previous/next navigation with 44 px targets and a live summary ("Página 2 · 31 solicitudes"). */
export function Pagination({ page, total, pageSize, hrefFor, noun, label = "Paginación" }: PaginationProps) {
  const hasPrevious = page > 1;
  const hasNext = page * pageSize < total;
  return (
    <nav aria-label={label} className="mt-6 flex flex-wrap items-center gap-3">
      {hasPrevious ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={hrefFor(page - 1)} rel="prev">Anterior</Link> : null}
      <span aria-live="polite" className="tabular text-sm text-muted-foreground">Página {page} · {total} {noun}</span>
      {hasNext ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={hrefFor(page + 1)} rel="next">Siguiente</Link> : null}
    </nav>
  );
}
