/** Must be configured explicitly in each environment, never derived from a forwarded Host. */
export function getAuthOrigin(): string {
  const raw = process.env.FIXO_APP_URL;
  if (!raw) throw new Error("Configuración de autenticación no disponible.");
  const url = new URL(raw);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Configuración de autenticación no disponible.");
  }
  return url.origin;
}
