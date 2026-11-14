import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { readonly className?: string; readonly label?: string }) {
  return (
    <span className="inline-flex items-center" role={label ? "status" : undefined}>
      <svg aria-hidden="true" className={cn("size-5 animate-spin", className)} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
