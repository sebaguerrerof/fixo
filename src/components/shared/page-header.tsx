import { cn } from "@/lib/utils";

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  /** Primary actions, aligned to the right on wide screens and below the text on small ones. */
  readonly actions?: React.ReactNode;
  readonly className?: string;
}

/** Page title block for dashboards: one h1, optional description and actions. No eyebrow above the heading. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-balance text-3xl leading-tight sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-prose leading-7 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
