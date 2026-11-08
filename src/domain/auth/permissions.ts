import type { UserRole } from "@/domain/enums/roles";

/** Foundation for Sprint 01. Call with a server-verified profile role only. */
export const PERMISSIONS = {
  "profile:read_own": ["customer", "technician", "moderator", "superadmin"],
  "request:create": ["customer"],
  "document:read_own": ["technician"],
  "document:read_all": ["moderator", "superadmin"],
  "technician:review": ["moderator", "superadmin"],
  "user:invite_technician": ["moderator", "superadmin"],
  "user:change_customer_technician_status": ["moderator", "superadmin"],
  "user:assign_privileged_role": ["superadmin"],
  "user:invite_administrator": ["superadmin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}
