import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  readonly title: string;
  readonly description?: string;
  readonly className?: string;
}

/** Section title. The heading carries its own weight: no kicker or eyebrow above it. */
export function SectionHeading({ title, description, className }: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <h2 className="text-balance text-3xl leading-tight sm:text-4xl">{title}</h2>
      {description ? <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
