import { isDemoModeEnabled } from "@/config/demo-mode";
import type { EmergencyRepository } from "@/repositories/contracts/emergency-repository";
import type { JobRepository } from "@/repositories/contracts/job-repository";
import type { QuoteRepository } from "@/repositories/contracts/quote-repository";
import type { ServiceRequestRepository } from "@/repositories/contracts/service-request-repository";
import type { TechnicianRepository } from "@/repositories/contracts/technician-repository";
import { MockEmergencyRepository } from "@/repositories/mock/mock-emergency-repository";
import { MockJobRepository } from "@/repositories/mock/mock-job-repository";
import { MockQuoteRepository } from "@/repositories/mock/mock-quote-repository";
import { MockServiceRequestRepository } from "@/repositories/mock/mock-service-request-repository";
import { MockTechnicianRepository } from "@/repositories/mock/mock-technician-repository";
import { SupabaseEmergencyRepository } from "@/repositories/supabase/supabase-emergency-repository";
import { SupabaseJobRepository } from "@/repositories/supabase/supabase-job-repository";
import { SupabaseQuoteRepository } from "@/repositories/supabase/supabase-quote-repository";
import { SupabaseServiceRequestRepository } from "@/repositories/supabase/supabase-service-request-repository";
import { SupabaseTechnicianRepository } from "@/repositories/supabase/supabase-technician-repository";

export function getTechnicianRepository(): TechnicianRepository {
  return isDemoModeEnabled() ? new MockTechnicianRepository() : new SupabaseTechnicianRepository();
}

export function getServiceRequestRepository(): ServiceRequestRepository {
  return isDemoModeEnabled() ? new MockServiceRequestRepository() : new SupabaseServiceRequestRepository();
}

export function getQuoteRepository(): QuoteRepository {
  return isDemoModeEnabled() ? new MockQuoteRepository() : new SupabaseQuoteRepository();
}

export function getJobRepository(): JobRepository {
  return isDemoModeEnabled() ? new MockJobRepository() : new SupabaseJobRepository();
}

export function getEmergencyRepository(): EmergencyRepository {
  return isDemoModeEnabled() ? new MockEmergencyRepository() : new SupabaseEmergencyRepository();
}
