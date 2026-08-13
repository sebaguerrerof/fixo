"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import type { UserRole } from "@/domain/enums/roles";
import { AuthenticationService } from "@/services/auth/authentication-service";

interface ProtectedDashboardProps {
  readonly allowedRoles: readonly UserRole[];
  readonly children: ReactNode;
}

export function ProtectedDashboard({ allowedRoles, children }: ProtectedDashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const session = new AuthenticationService().getCurrentSession();
    if (!session) {
      router.replace(`/login?continuar=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!allowedRoles.includes(session.user.role)) {
      router.replace("/login");
      return;
    }

    setHasAccess(true);
  }, [allowedRoles, pathname, router]);

  if (!hasAccess) {
    return <div className="flex min-h-[45vh] items-center justify-center"><div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Comprobando tu acceso</div></div>;
  }

  return <>{children}</>;
}
