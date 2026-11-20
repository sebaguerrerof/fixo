import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { TechnicianCard } from "@/components/technicians/technician-card";
import { buttonVariants } from "@/components/ui/button";
import type { Technician } from "@/domain/entities/technician";

/** Published technicians for a service (and optionally a commune). Public: no account needed to look. */
export function ServiceListing({ technicians, emptyTitle, emptyDescription, requestHref = "/solicitar", headingLevel = 3 }: { readonly technicians: readonly Technician[]; readonly emptyTitle: string; readonly emptyDescription: string; readonly requestHref?: string; readonly headingLevel?: 2 | 3 }) {
  if (!technicians.length) {
    return (
      <EmptyState
        action={<Link className={buttonVariants({ variant: "outline" })} href={requestHref}>Pedir este servicio igual</Link>}
        description={emptyDescription}
        icon={SearchX}
        title={emptyTitle}
      />
    );
  }
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{technicians.map((technician) => <TechnicianCard headingLevel={headingLevel} key={technician.id} technician={technician} />)}</div>;
}
