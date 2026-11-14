"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AuthenticationService } from "@/services/auth/authentication-service";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Button
        loading={pending}
        onClick={async () => {
          setPending(true);
          try { await new AuthenticationService().signOut(); router.replace("/login"); router.refresh(); }
          catch { setError("No pudimos cerrar la sesión. Inténtalo nuevamente."); }
          finally { setPending(false); }
        }}
        type="button"
        variant="outline"
      >
        Cerrar sesión
      </Button>
      {error ? <p className="mt-3 text-sm text-destructive-soft-foreground" role="alert">{error}</p> : null}
    </>
  );
}
