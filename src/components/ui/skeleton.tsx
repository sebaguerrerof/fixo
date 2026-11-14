import { cn } from "@/lib/utils";

/** Placeholder block. Give it the exact size of the content it replaces to avoid layout shift. */
export function Skeleton({ className }: { readonly className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

export function SkeletonText({ lines = 3, className }: { readonly lines?: number; readonly className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")} />)}
    </div>
  );
}

export function SkeletonCard({ className }: { readonly className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-4 rounded-xl border border-border/70 bg-card p-5", className)}>
      <div className="flex items-center gap-3"><Skeleton className="size-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></div>
      <SkeletonText lines={3} />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

/** Announces loading to assistive technology once for the whole region. */
export function LoadingRegion({ children, label = "Cargando contenido" }: { readonly children: React.ReactNode; readonly label?: string }) {
  return <div aria-busy="true" aria-live="polite" role="status"><span className="sr-only">{label}</span>{children}</div>;
}
