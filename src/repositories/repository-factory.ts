import { isDemoModeEnabled } from "@/config/demo-mode";
import type { EmergencyRepository } from "@/repositories/contracts/emergency-repository";
import type { JobRepository } from "@/repositories/contracts/job-repository";
import type { PaymentInboxRepository, PaymentProcessingRepository, PaymentRateLimiter, PaymentRepository, PaymentWorkerRepository } from "@/repositories/contracts/payment-repository";
import { SupabasePaymentInboxRepository, SupabasePaymentProcessingRepository, SupabasePaymentRateLimiter, SupabasePaymentRepository, SupabasePaymentWorkerRepository } from "@/repositories/supabase/supabase-payment-repository";
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

/** Payments have no mock: demo mode must never simulate a charge. */
export function getPaymentRepository(): PaymentRepository {
  if (isDemoModeEnabled()) throw new Error("Los pagos no están disponibles en modo demostración.");
  return new SupabasePaymentRepository();
}

export function getPaymentProcessingRepository(): PaymentProcessingRepository {
  if (isDemoModeEnabled()) throw new Error("Los pagos no están disponibles en modo demostración.");
  return new SupabasePaymentProcessingRepository();
}

export function getEmergencyRepository(): EmergencyRepository {
  return isDemoModeEnabled() ? new MockEmergencyRepository() : new SupabaseEmergencyRepository();
}

export function getPaymentInboxRepository(): PaymentInboxRepository {
  if (isDemoModeEnabled()) throw new Error("Los pagos no están disponibles en modo demostración.");
  return new SupabasePaymentInboxRepository();
}

export function getPaymentWorkerRepository(): PaymentWorkerRepository {
  if (isDemoModeEnabled()) throw new Error("Los pagos no están disponibles en modo demostración.");
  return new SupabasePaymentWorkerRepository();
}

export function getPaymentRateLimiter(): PaymentRateLimiter {
  if (isDemoModeEnabled()) throw new Error("Los pagos no están disponibles en modo demostración.");
  return new SupabasePaymentRateLimiter();
}
