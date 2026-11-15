"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { dashboardForRole, type AuthSession } from "@/integrations/auth/auth-provider";
import { AuthenticationService } from "@/services/auth/authentication-service";
import { cn } from "@/lib/utils";

export function AccountAccess() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let isMounted = true;
    void new AuthenticationService().getCurrentSession().then((nextSession) => { if (isMounted) setSession(nextSession); }).catch(() => { if (isMounted) setSession(null); });
    return () => { isMounted = false; };
  }, []);

  async function signOut(): Promise<void> {
    await new AuthenticationService().signOut();
    setSession(null);
    router.push("/");
  }

  if (!session) {
    return <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden md:inline-flex")} href="/login"><UserRound className="size-4" />Ingresar</Link>;
  }

  return <div className="hidden items-center gap-2 md:flex"><Link className="flex items-center gap-2 rounded-full p-1 pr-3 text-sm font-semibold transition hover:bg-muted" href={dashboardForRole(session.user.role)}><Avatar className="size-7 text-[10px]" name={session.user.name} />Mi panel</Link><Button aria-label="Cerrar sesión" onClick={signOut} size="icon" type="button" variant="ghost"><LogOut aria-hidden="true" className="size-4" /></Button></div>;
}
