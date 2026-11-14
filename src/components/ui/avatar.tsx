import { cn } from "@/lib/utils";

interface AvatarProps {
  readonly name: string;
  readonly className?: string;
}

function initials(name: string): string {
  return name.split(" ").map((part) => part.at(0)).join("").slice(0, 2).toUpperCase();
}

export function Avatar({ name, className }: AvatarProps) {
  return (
    <div aria-label={name} className={cn("flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground", className)}>
      {initials(name)}
    </div>
  );
}
