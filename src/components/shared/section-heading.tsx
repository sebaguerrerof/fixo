import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  readonly title: string;
  readonly description?: string;
  readonly className?: string;
  /** Use "h1" when this is the page title. */
  readonly as?: "h1" | "h2";
}

/** Section title. The heading carries its own weight: no kicker or eyebrow above it. */
export function SectionHeading({ title, description, className, as: Heading = "h2" }: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <Heading className="text-balance text-3xl leading-tight sm:text-4xl">{title}</Heading>
      {description ? <p className="mt-3 max-w-prose text-base leading-7 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
