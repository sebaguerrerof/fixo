import { cn } from "@/lib/utils";

interface PageHeaderProps {
  readonly title: string;
  readonly eyebrow?: string;
  readonly description?: string;
  /** Primary actions, aligned to the right on wide screens and below the text on small ones. */
  readonly actions?: React.ReactNode;
  readonly className?: string;
}

/** Page title block for dashboards: one h1, optional eyebrow, description and actions. */
export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
        <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 leading-7 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
