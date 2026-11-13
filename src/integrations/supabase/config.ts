export class ConfigurationError extends Error {
  constructor() {
    super("Fixo no está disponible temporalmente. Inténtalo más tarde.");
    this.name = "ConfigurationError";
  }
}

export function getSupabasePublicConfig(): { readonly url: string; readonly publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url?.trim() || !publishableKey?.trim() || url.includes("your-project") || publishableKey.includes("your_key")) {
    throw new ConfigurationError();
  }
  try {
    const parsed = new URL(url);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/"
      || (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback))) throw new ConfigurationError();
    if (publishableKey.startsWith("sb_secret_")) throw new ConfigurationError();
    if (!publishableKey.startsWith("sb_publishable_")) {
      const payload = publishableKey.split(".")[1];
      if (!payload || JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role !== "anon") throw new ConfigurationError();
    }
  } catch {
    throw new ConfigurationError();
  }
  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  try { getSupabasePublicConfig(); return true; } catch { return false; }
}
