import { requireServerRole } from "@/services/auth/server-authentication-service";

export default async function TechnicianLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireServerRole(["technician"]);
  return children;
}
