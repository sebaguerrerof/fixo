export function throwIfSupabaseError(error: { readonly message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function asRecords(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : typeof value === "string" && Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
