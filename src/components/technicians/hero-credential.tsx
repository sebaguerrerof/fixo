import { CredentialCard, CredentialSlot } from "@/components/technicians/credential-card";
import { TextLink } from "@/components/ui/text-link";
import { brand } from "@/design-system/brand";
import type { Technician } from "@/domain/entities/technician";

/**
 * The credential in the home hero: a real approved profile, or the honest empty slot when none is published yet.
 * Both sit directly under the page's h1, so both use an h2 for their title (no skipped heading level).
 */
export function HeroCredential({ technician }: { readonly technician: Technician | null }) {
  if (technician) return <CredentialCard animateStamp headingLevel={2} technician={technician} />;
  return (
    <CredentialSlot headingLevel={2} title="Aquí aparecerá el primer perfil aprobado">
      <p>Cada técnico publicado pasó antes por la revisión del equipo de {brand.name}. Estamos sumando a los primeros.</p>
      <p>La contratación y los pagos todavía no están habilitados.</p>
      <TextLink className="underline" href="/registro/tecnico">¿Eres técnico? Postula tu perfil</TextLink>
    </CredentialSlot>
  );
}
