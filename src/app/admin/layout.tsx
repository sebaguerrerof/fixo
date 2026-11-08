import { requireServerRole } from "@/services/auth/server-authentication-service";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireServerRole(["moderator", "superadmin"]);
  return children;
}
