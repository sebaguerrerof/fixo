/** The customer panel's menu. One definition so every customer page (summary, request detail, jobs) shows the same entries. */
export const customerNavigation = [
  { href: "/cliente", label: "Mis solicitudes" },
  { href: "/cliente/trabajos", label: "Mis trabajos" },
  { href: "/perfil", label: "Mi perfil" },
] as const;
