import { SearchX } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return <><SiteHeader /><main className="container flex min-h-[70vh] items-center justify-center pb-24 pt-16 md:pb-16"><div className="max-w-md animate-enter text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary"><SearchX className="size-7" /></span><h1 className="mt-6 text-3xl font-bold">No encontramos esta página</h1><p className="mt-3 text-muted-foreground">Puede que el enlace haya cambiado o que el técnico ya no esté disponible.</p><Link className={`${buttonVariants({ size: "lg" })} mt-7`} href="/tecnicos">Explorar técnicos</Link></div></main></>;
}
