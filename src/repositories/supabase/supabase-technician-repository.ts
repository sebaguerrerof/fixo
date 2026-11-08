import type { Category, CategoryIcon } from "@/domain/entities/category";
import type { Technician, TechnicianMetrics } from "@/domain/entities/technician";
import type { TechnicianStatus } from "@/domain/enums/technician-status";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import type { TechnicianRepository, TechnicianSearchFilters } from "@/repositories/contracts/technician-repository";
import { matchesClientFilters, sortTechnicians } from "@/repositories/shared/technician-search";
import { asNumber, asRecord, asRecords, asString, asStringArray, throwIfSupabaseError } from "@/repositories/supabase/supabase-helpers";

const publicStatuses: readonly TechnicianStatus[] = ["verified", "active"];
const categoryIcons = new Set<CategoryIcon>(["bolt", "droplets", "key-round", "snowflake", "monitor-cog", "wrench", "paint-roller", "sprout"]);

function mapMetrics(value: unknown): TechnicianMetrics {
  const metrics = asRecord(Array.isArray(value) ? value.at(0) : value);
  return {
    rating: asNumber(metrics.rating),
    reviewCount: asNumber(metrics.review_count),
    completedJobs: asNumber(metrics.completed_jobs),
    responseTimeMinutes: asNumber(metrics.response_time_minutes),
    completionRate: asNumber(metrics.completion_rate),
  };
}

function mapTechnician(value: unknown): Technician {
  const row = asRecord(value);
  const profile = asRecord(Array.isArray(row.profiles) ? row.profiles.at(0) : row.profiles);
  const categories = asRecords(row.technician_categories).map((item) => asString(item.category_id)).filter(Boolean);
  const specialties = asRecords(row.technician_specialties).map((item) => asString(item.name)).filter(Boolean);

  return {
    id: asString(row.user_id),
    slug: asString(row.slug),
    displayName: asString(profile.full_name, "Técnico Fixo"),
    avatarUrl: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    city: asString(row.city),
    coverageAreas: asStringArray(row.coverage_areas),
    headline: asString(row.headline),
    bio: asString(row.bio),
    status: asString(row.status, "draft") as TechnicianStatus,
    categoryIds: categories,
    specialties,
    yearsOfExperience: asNumber(row.years_of_experience),
    emergencyEnabled: Boolean(row.emergency_enabled),
    startingPriceClp: asNumber(row.starting_price_clp),
    metrics: mapMetrics(row.technician_metrics),
  };
}

const technicianSelection = "user_id, slug, city, coverage_areas, headline, bio, status, years_of_experience, emergency_enabled, starting_price_clp, profiles!inner(full_name, avatar_url), technician_categories!inner(category_id), technician_specialties(name), technician_metrics(rating, review_count, completed_jobs, response_time_minutes, completion_rate)";

export class SupabaseTechnicianRepository implements TechnicianRepository {
  async listCategories(): Promise<readonly Category[]> {
    const supabase = await getSupabaseServerClient();
    const [{ data: categories, error: categoryError }, { data: memberships, error: membershipError }] = await Promise.all([
      supabase.from("categories").select("id, slug, name, description, icon").order("name"),
      supabase.from("technician_categories").select("category_id"),
    ]);
    throwIfSupabaseError(categoryError, "No pudimos cargar las categorías");
    throwIfSupabaseError(membershipError, "No pudimos contar los técnicos por categoría");

    const counts = new Map<string, number>();
    asRecords(memberships).forEach((membership) => {
      const categoryId = asString(membership.category_id);
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    });

    return asRecords(categories).map((category) => {
      const icon = asString(category.icon) as CategoryIcon;
      return {
        id: asString(category.id),
        slug: asString(category.slug),
        name: asString(category.name),
        description: asString(category.description),
        icon: categoryIcons.has(icon) ? icon : "wrench",
        technicianCount: counts.get(asString(category.id)) ?? 0,
      };
    });
  }

  async search(filters: TechnicianSearchFilters = {}): Promise<readonly Technician[]> {
    const supabase = await getSupabaseServerClient();
    let query = supabase.from("technician_profiles").select(technicianSelection).in("status", publicStatuses);
    if (filters.categoryId) query = query.eq("technician_categories.category_id", filters.categoryId);
    const { data, error } = await query;
    throwIfSupabaseError(error, "No pudimos cargar el directorio de técnicos");

    return sortTechnicians(asRecords(data).map(mapTechnician).filter((technician) => matchesClientFilters(technician, filters)), filters.sort);
  }

  async findBySlug(slug: string): Promise<Technician | null> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("technician_profiles").select(technicianSelection).eq("slug", slug).maybeSingle();
    throwIfSupabaseError(error, "No pudimos cargar el perfil del técnico");
    return data ? mapTechnician(data) : null;
  }

  async findByUserId(userId: string): Promise<Technician | null> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("technician_profiles").select(technicianSelection).eq("user_id", userId).maybeSingle();
    throwIfSupabaseError(error, "No pudimos cargar tu perfil técnico");
    return data ? mapTechnician(data) : null;
  }

  async featured(limit: number): Promise<readonly Technician[]> {
    return (await this.search({ sort: "recommended" })).slice(0, limit);
  }

  async listForAdministration(): Promise<readonly Technician[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("technician_profiles").select(technicianSelection).order("submitted_at", { ascending: false });
    throwIfSupabaseError(error, "No pudimos cargar los perfiles de administración");
    return sortTechnicians(asRecords(data).map(mapTechnician), "recommended");
  }
}
