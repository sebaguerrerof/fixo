import Link from "next/link";

import { LogoMark } from "@/components/shared/logo";
import { brand } from "@/design-system/brand";
import type { Technician } from "@/domain/entities/technician";
import { cn, formatClp } from "@/lib/utils";

const APPROVED = ["active", "verified"];

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((part) => part.at(0)).join("").slice(0, 2).toUpperCase();
}

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-dotted border-foreground/40 py-1.5">
      <dt className="w-[5.5rem] shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

interface CredentialCardProps {
  readonly technician: Technician;
  /** "card" is a list item whose whole surface links to the profile; "page" is the large header of the profile itself. */
  readonly variant?: "card" | "page";
  /** Plays the stamp once. Use on at most one credential per screen. */
  readonly animateStamp?: boolean;
  /** Heading level of the name in the "card" variant, so it never skips a level under the page or section title. */
  readonly headingLevel?: 2 | 3;
}

/**
 * The published technician as a credential (carné). Everything on it is real profile data: no photo, serial number or review date
 * is invented. The "number" is the profile's own public address. The stamp only appears for approved profiles.
 */
export function CredentialCard({ technician, variant = "card", animateStamp = false, headingLevel = 3 }: CredentialCardProps) {
  const page = variant === "page";
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const approved = APPROVED.includes(technician.status);
  const address = `${brand.domain}/tecnicos/${technician.slug}`;
  return (
    <article className="relative overflow-hidden rounded-lg border-2 border-foreground bg-card">
      <div className="flex items-center justify-between bg-inverse px-4 py-2 text-inverse-foreground">
        <span className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.16em]"><LogoMark className="size-5" />{brand.name}</span>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-inverse-muted">Técnico</span>
      </div>
      <div className={cn("p-4", page ? "sm:p-6" : "sm:p-5")}>
        <div className="flex gap-4">
          <div aria-hidden="true" className={cn("flex shrink-0 items-center justify-center border-2 border-foreground bg-muted font-display font-bold", page ? "size-24 text-4xl" : "size-20 text-3xl")}>{initials(technician.displayName)}</div>
          <div className="min-w-0">
            {page
              ? <h1 className="text-balance text-3xl leading-tight sm:text-4xl">{technician.displayName}</h1>
              : <Heading className="text-2xl leading-tight"><Link className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none" href={`/tecnicos/${technician.slug}`}>{technician.displayName}</Link></Heading>}
            <p className={cn("mt-1 text-muted-foreground", page ? "text-base" : "text-sm")}>{technician.headline}</p>
          </div>
        </div>
        <dl className="mt-4">
          <Field label="Rubro">{technician.specialties.join(", ") || "—"}</Field>
          <Field label="Comuna">{technician.city}</Field>
          <Field label="Experiencia">{technician.yearsOfExperience} años, declarada</Field>
          <Field label="Valor ref."><span className="tabular">{technician.startingPriceClp > 0 ? formatClp(technician.startingPriceClp) : "A convenir"}</span></Field>
        </dl>
      </div>
      <div className="flex items-end justify-between gap-3 border-t-2 border-foreground px-4 py-3">
        <p className="tabular min-w-0 break-all text-xs text-muted-foreground">{address}</p>
        {approved ? <span className={cn("shrink-0 -rotate-6 rounded-sm border-2 border-primary px-2 py-0.5 font-display text-sm font-bold uppercase tracking-[0.12em] text-primary", animateStamp && "stamp-in")}>Perfil aprobado</span> : null}
      </div>
    </article>
  );
}

/** An empty credential slot: what the directory honestly looks like before the first profile is approved. */
export function CredentialSlot({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-foreground/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Carné pendiente</p>
      <h3 className="mt-2 text-2xl leading-tight">{title}</h3>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </div>
  );
}
