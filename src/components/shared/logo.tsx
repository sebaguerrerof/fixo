import { Wrench } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface LogoProps {
  readonly inverse?: boolean;
}

export function Logo({ inverse = false }: LogoProps) {
  return (
    <Link className={cn("flex items-center gap-2 font-bold tracking-tight text-foreground", inverse && "text-white")} href="/">
      <span className={cn("flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground", inverse && "bg-white text-primary")}>
        <Wrench className="size-4" strokeWidth={2.5} />
      </span>
      <span>fixo</span>
    </Link>
  );
}
