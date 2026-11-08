import { isDemoModeEnabled } from "@/config/demo-mode";
import { MockAdminManagementStore } from "@/services/admin/mock-admin-management-store";
import { SupabaseAdminManagementStore } from "@/services/admin/supabase-admin-management-store";

export function getAdminManagementStore(): MockAdminManagementStore | SupabaseAdminManagementStore {
  return isDemoModeEnabled() ? new MockAdminManagementStore() : new SupabaseAdminManagementStore();
}
