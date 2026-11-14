import { Inbox, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly icon?: LucideIcon;
  readonly action?: React.ReactNode;
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-6" /></span>
        <h2 className="mt-5 text-lg font-semibold">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
