import { ArrowUpRight, BadgeCheck, MapPin, Zap } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Rating } from "@/components/shared/rating";
import type { Technician } from "@/domain/entities/technician";
import { formatClp } from "@/lib/utils";

export function TechnicianCard({ technician }: { readonly technician: Technician }) {
  return (
    <Card className="group h-full overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-lift">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={technician.displayName} className="size-12" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate font-bold text-foreground">{technician.displayName}</h3>
                <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Perfil verificado" />
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{technician.headline}</p>
            </div>
          </div>
          <Link aria-label={`Ver perfil de ${technician.displayName}`} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" href={`/tecnicos/${technician.slug}`}>
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {technician.specialties.slice(0, 2).map((specialty) => <Badge key={specialty} variant="secondary">{specialty}</Badge>)}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-border/70 py-4">
          <div><Rating rating={technician.metrics.rating} reviewCount={technician.metrics.reviewCount} /></div>
          <p className="text-right text-sm text-muted-foreground">{technician.yearsOfExperience} años exp.</p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="size-4" />{technician.city}</span>
          {technician.emergencyEnabled ? <span className="inline-flex items-center gap-1 font-semibold text-rose-600"><Zap className="size-4 fill-current" />Urgencias</span> : null}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
          <p className="text-sm text-muted-foreground">Desde <span className="font-semibold text-foreground">{formatClp(technician.startingPriceClp)}</span></p>
          <Link className="text-sm font-semibold text-primary hover:underline" href={`/tecnicos/${technician.slug}`}>Ver perfil</Link>
        </div>
      </CardContent>
    </Card>
  );
}
