import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly className?: string;
}

export function SectionHeading({ eyebrow, title, description, className }: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? <p className="mb-3 text-sm font-semibold text-primary">{eyebrow}</p> : null}
      <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
