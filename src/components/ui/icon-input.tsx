import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface IconInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly icon: LucideIcon;
  /** Interactive element placed over the right edge of the field (e.g. show/hide password). Give it a 44 px target; the UI audit
   * accepts it overlapping the input only because it is wrapped in data-field-adornment. */
  readonly trailing?: React.ReactNode;
}

/** Input with a decorative leading icon. The icon never intercepts clicks. */
export const IconInput = React.forwardRef<HTMLInputElement, IconInputProps>(({ icon: Icon, trailing, className, ...props }, ref) => (
  <div className="relative">
    <Icon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input className={cn("pl-10", trailing ? "pr-12" : undefined, className)} ref={ref} {...props} />
    {trailing ? <div className="absolute inset-y-0 right-0 flex items-center" data-field-adornment="">{trailing}</div> : null}
  </div>
));
IconInput.displayName = "IconInput";
