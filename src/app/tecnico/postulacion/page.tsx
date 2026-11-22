import { permanentRedirect } from "next/navigation";

/** The application now lives in "Mi perfil profesional"; this keeps old links and bookmarks working. */
export default function ProfessionalApplicationPage() {
  permanentRedirect("/tecnico/perfil");
}
