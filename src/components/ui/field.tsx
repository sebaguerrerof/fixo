import * as React from "react";

import { cn } from "@/lib/utils";

const control = "block w-full rounded-lg border border-input bg-card px-3.5 text-foreground shadow-sm transition-colors duration-fast placeholder:text-muted-foreground hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type = "text", ...props }, ref) => (
  <input className={cn(control, "h-11 sm:h-10", className)} ref={ref} type={type} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea className={cn(control, "min-h-28 py-2.5", className)} ref={ref} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select className={cn(control, "h-11 pr-9 sm:h-10", className)} ref={ref} {...props}>{children}</select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium leading-none text-foreground", className)} {...props} />;
}

interface FieldProps {
  readonly label: string;
  readonly htmlFor: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}

/** Label + control + hint/error. Point the control's aria-describedby at `${htmlFor}-msg`. */
export function Field({ label, htmlFor, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive-soft-foreground" id={`${htmlFor}-msg`} role="alert">{error}</p> : hint ? <p className="text-sm text-muted-foreground" id={`${htmlFor}-msg`}>{hint}</p> : null}
    </div>
  );
}

export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(({ className, ...props }, ref) => (
  <input className={cn("checkbox", className)} ref={ref} type="checkbox" {...props} />
));
Checkbox.displayName = "Checkbox";

/** A checkbox row: the whole row is the click target (min 44 px high). Use for lists of options and consent lines. */
export function CheckboxRow({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return <label className={cn("flex min-h-11 cursor-pointer items-center gap-4 text-sm leading-6", className)}>{children}</label>;
}
