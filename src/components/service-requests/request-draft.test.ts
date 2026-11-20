import { describe, expect, it } from "vitest";

import { DRAFT_KEY, DRAFT_TTL_MS, clearDraft, loadDraft, saveDraft } from "./request-draft";

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), removeItem: (key: string) => void data.delete(key) };
}

describe("service request draft", () => {
  const values = { title: "Revisión de tablero", categoryId: "electricidad", description: "Se calienta una llave.", locationLabel: "Ñuñoa", scheduledFor: "", preferredSlot: "mañana" };

  it("saves and restores the public fields", () => {
    const storage = memoryStorage();
    saveDraft(values, storage, 1000);
    expect(loadDraft(storage, 2000)).toEqual(values);
  });

  it("never writes the private fields", () => {
    const storage = memoryStorage();
    saveDraft({ ...values, address: "Calle Secreta 123", reference: "casa azul", complementaryInfo: "portón" } as never, storage, 1000);
    const stored = storage.data.get(DRAFT_KEY)!;
    expect(stored).not.toContain("Secreta");
    expect(stored).not.toContain("casa azul");
    expect(stored).not.toContain("portón");
  });

  it("expires after a day and is removed", () => {
    const storage = memoryStorage();
    saveDraft(values, storage, 1000);
    expect(loadDraft(storage, 1000 + DRAFT_TTL_MS + 1)).toBeNull();
    expect(storage.data.has(DRAFT_KEY)).toBe(false);
  });

  it("ignores an empty request, corrupt data and unavailable storage", () => {
    const storage = memoryStorage();
    saveDraft({ ...values, title: "", description: "" }, storage);
    expect(storage.data.size).toBe(0);
    storage.data.set(DRAFT_KEY, "{not json");
    expect(loadDraft(storage)).toBeNull();
    storage.data.set(DRAFT_KEY, JSON.stringify({ savedAt: 1, draft: "x" }));
    expect(loadDraft(storage, 2)).toBeNull();
    expect(() => saveDraft(values, null)).not.toThrow();
    expect(loadDraft(null)).toBeNull();
  });

  it("clears the draft", () => {
    const storage = memoryStorage();
    saveDraft(values, storage);
    clearDraft(storage);
    expect(loadDraft(storage)).toBeNull();
  });
});
