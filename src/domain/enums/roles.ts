export const USER_ROLES = ["customer", "technician", "moderator", "superadmin"] as const;

export type UserRole = (typeof USER_ROLES)[number];
