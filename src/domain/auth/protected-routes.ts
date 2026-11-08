import type { UserRole } from "@/domain/enums/roles";

const routes: readonly { prefix:string; roles:readonly UserRole[] }[] = [
  {prefix:"/admin",roles:["moderator","superadmin"]},
  {prefix:"/cliente",roles:["customer"]},
  {prefix:"/tecnico",roles:["technician"]},
];
export function allowedRouteRoles(pathname:string): readonly UserRole[] | null {
  return routes.find(route=>pathname===route.prefix || pathname.startsWith(route.prefix+"/"))?.roles ?? null;
}
