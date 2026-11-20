/**
 * Browser-only draft of a service request, so a visitor without an account does not lose what they wrote
 * while they sign in or create the account (the confirmation e-mail may open another tab, hence localStorage).
 *
 * Only the public part of the request is kept. The private fields (address, reference, extra information) are
 * never written to the browser. The draft expires and is removed once the request is registered.
 */
export const DRAFT_KEY = "fixo.service-request-draft.v1";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface RequestDraft {
  readonly title: string;
  readonly categoryId: string;
  readonly description: string;
  readonly locationLabel: string;
  readonly scheduledFor: string;
  readonly preferredSlot: string;
}

const fields = ["title", "categoryId", "description", "locationLabel", "scheduledFor", "preferredSlot"] as const;
const maxLength = 4000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function saveDraft(values: Partial<Record<keyof RequestDraft, unknown>>, storage: StorageLike | null = browserStorage(), now = Date.now()): void {
  if (!storage) return;
  const draft: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field];
    draft[field] = typeof value === "string" ? value.slice(0, maxLength) : "";
  }
  if (!draft.title && !draft.description) return; // nothing worth keeping
  try { storage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: now, draft })); } catch { /* storage full or blocked: the form still works */ }
}

export function loadDraft(storage: StorageLike | null = browserStorage(), now = Date.now()): RequestDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { savedAt, draft } = parsed as { savedAt?: unknown; draft?: unknown };
    if (typeof savedAt !== "number" || now - savedAt > DRAFT_TTL_MS || now < savedAt) { storage.removeItem(DRAFT_KEY); return null; }
    if (typeof draft !== "object" || draft === null) return null;
    const result: Record<string, string> = {};
    for (const field of fields) {
      const value = (draft as Record<string, unknown>)[field];
      result[field] = typeof value === "string" ? value.slice(0, maxLength) : "";
    }
    return result as unknown as RequestDraft;
  } catch {
    return null;
  }
}

export function clearDraft(storage: StorageLike | null = browserStorage()): void {
  try { storage?.removeItem(DRAFT_KEY); } catch { /* nothing to clean */ }
}
