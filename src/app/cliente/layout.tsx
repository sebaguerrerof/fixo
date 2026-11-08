import { requireServerRole } from "@/services/auth/server-authentication-service";

export default async function CustomerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireServerRole(["customer"]);
  return children;
}
