import Link from "next/link";

import { cn } from "@/lib/utils";
import { brand } from "@/design-system/brand";

interface LogoMarkProps {
  readonly className?: string;
}

/** Brand mark: rounded square with an "S" stroke and a spark. Colours come from tokens (currentColor / fill-*). */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg aria-hidden="true" className={cn("size-8 shrink-0", className)} fill="none" viewBox="0 0 32 32">
      <rect className="fill-primary" height="32" rx="9" width="32" />
      <path className="stroke-primary-foreground" d="M21.2 11.4c-1.1-1.5-2.9-2.4-5-2.4-2.9 0-5.1 1.5-5.1 3.7 0 5.5 10.1 2.5 10.1 8 0 2.3-2.2 3.8-5.1 3.8-2.3 0-4.2-1-5.3-2.7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <circle className="fill-primary-foreground/70" cx="23.5" cy="8.5" r="2" />
    </svg>
  );
}

interface LogoProps {
  /** Use on always-dark surfaces (bg-inverse). */
  readonly inverse?: boolean;
  readonly className?: string;
}

export function Logo({ inverse = false, className }: LogoProps) {
  return (
    <Link aria-label={`${brand.name}, ir al inicio`} className={cn("press touch-area flex items-center gap-2.5 text-lg tracking-tight", inverse ? "text-inverse-foreground" : "text-foreground", className)} href="/">
      <LogoMark />
      <span className="leading-none"><span className="font-medium opacity-80">Soy</span><span className="font-bold">Fixo</span></span>
    </Link>
  );
}
