import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "press touch-area inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        emergency: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        link: "h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 sm:h-10",
        sm: "h-10 rounded-md px-3 sm:h-9",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "size-11 sm:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Shows a spinner and blocks repeated activation. */
  readonly loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading = false, disabled, children, ...props }, ref) => (
  <button aria-busy={loading || undefined} className={cn(buttonVariants({ variant, size, className }))} disabled={disabled || loading} ref={ref} {...props}>
    {loading ? <Spinner className="size-4" /> : null}
    {children}
  </button>
));
Button.displayName = "Button";

export { Button };
