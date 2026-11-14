import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-xl border p-4 text-sm", {
  variants: {
    tone: {
      info: "border-info-border bg-info-soft text-info-soft-foreground",
      success: "border-success-border bg-success-soft text-success-soft-foreground",
      warning: "border-warning-border bg-warning-soft text-warning-soft-foreground",
      danger: "border-destructive-border bg-destructive-soft text-destructive-soft-foreground",
    },
  },
  defaultVariants: { tone: "info" },
});

const icons: Record<NonNullable<VariantProps<typeof alertVariants>["tone"]>, LucideIcon> = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

interface AlertProps extends VariantProps<typeof alertVariants> {
  readonly title?: string;
  readonly children?: React.ReactNode;
  readonly className?: string;
}

export function Alert({ tone = "info", title, children, className }: AlertProps) {
  const Icon = icons[tone ?? "info"];
  return (
    <div className={cn(alertVariants({ tone }), className)} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">{title ? <p className="font-semibold">{title}</p> : null}{children ? <div className="leading-relaxed">{children}</div> : null}</div>
    </div>
  );
}
