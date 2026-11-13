"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticationService } from "@/services/auth/authentication-service";
import { Button } from "@/components/ui/button";
export function LogoutButton() {
  const router = useRouter(); const [pending,setPending]=useState(false); const [error,setError]=useState("");
  return <><Button variant="outline" disabled={pending} onClick={async()=>{setPending(true);try {await new AuthenticationService().signOut();router.replace("/login");router.refresh();} catch {setError("No pudimos cerrar la sesión. Inténtalo nuevamente.");} finally {setPending(false);}}}>{pending?"Cerrando…":"Cerrar sesión"}</Button>{error?<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>:null}</>;
}
