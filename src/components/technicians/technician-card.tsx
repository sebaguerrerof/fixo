import { CredentialCard } from "@/components/technicians/credential-card";
import type { Technician } from "@/domain/entities/technician";

/** A technician in a list: the credential card. The whole surface links to the profile. */
export function TechnicianCard({ technician, headingLevel }: { readonly technician: Technician; readonly headingLevel?: 2 | 3 }) {
  return <CredentialCard headingLevel={headingLevel} technician={technician} />;
}
