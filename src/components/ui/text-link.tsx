import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Stand-alone link (not inside a sentence) with a comfortable 44 px target. Inline links inside text use a plain <Link>. */
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn("inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline", className)} {...props} />;
}
