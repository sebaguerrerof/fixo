import { cn } from "@/lib/utils";

interface BreakdownRow {
  readonly label: string;
  readonly value: string;
  /** The total row: heavier and set off from the rest. */
  readonly strong?: boolean;
}

/** Itemised amounts as a receipt: label, dotted leader, value. Informational only; the server recomputes every amount. */
export function PriceBreakdown({ rows }: { readonly rows: readonly BreakdownRow[] }) {
  return (
    <dl className="text-sm">
      {rows.map((row) => (
        <div className={cn("flex items-baseline gap-3 py-1.5", row.strong ? "border-t-2 border-foreground pt-2.5 text-base font-semibold" : "border-b border-dotted border-foreground/40")} key={row.label}>
          <dt className="flex-1">{row.label}</dt>
          <dd className="tabular text-right">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
