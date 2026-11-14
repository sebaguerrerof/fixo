import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  /** Optional plain glyph next to the title (no tile behind it). */
  readonly icon?: LucideIcon;
  readonly action?: React.ReactNode;
}

export function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="py-10">
        <h2 className="flex items-center gap-2 text-xl">{Icon ? <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /> : null}{title}</h2>
        <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
