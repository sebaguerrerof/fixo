// Logic of `npm run local:create-admin`, free of I/O so it can be tested with in-memory doubles (local-admin-lib.test.mjs).
import { parseEnv } from "node:util";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads an env file the way dotenv does (quotes, spaces around "=", comments, `export`), never by hand-splitting lines. */
export function readLocalEnv(text) {
  return parseEnv(text);
}

/**
 * Refuses anything that is not ONE local Supabase stack: the API URL must be loopback, and the database container must belong to
 * the very stack that publishes that API port (its kong container). Runs BEFORE anything is written.
 * `run(command, args)` returns a command's stdout (docker, in production).
 */
export function assertSameLocalStack({ env, container, run }) {
  const apiUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  let url;
  try { url = new URL(apiUrl); } catch { throw new Error("NEXT_PUBLIC_SUPABASE_URL no es una URL válida."); }
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Rechazado: NEXT_PUBLIC_SUPABASE_URL no es local. Este script solo corre contra Supabase en Docker.");
  if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  const project = /^supabase_db_(.+)$/.exec(container)?.[1];
  if (!project) throw new Error(`El contenedor de base de datos "${container}" no sigue el nombre supabase_db_<proyecto>.`);
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  let published = "";
  try { published = run("docker", ["port", `supabase_kong_${project}`, "8000/tcp"]); } catch { /* handled below */ }
  if (!published.split(/\r?\n/).some((line) => line.trim().endsWith(`:${port}`))) {
    throw new Error(`Rechazado: la API ${url.origin} no corresponde al stack del contenedor ${container} (supabase_kong_${project} no publica el puerto ${port}). Creación y promoción deben apuntar a la misma instancia.`);
  }
  return { apiUrl: url.origin, serviceKey };
}

async function authAdmin(fetchImpl, apiUrl, serviceKey, path, init = {}) {
  return fetchImpl(`${apiUrl}/auth/v1/admin/${path}`, { ...init, headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...(init.headers ?? {}) } });
}

async function findUserId(fetchImpl, apiUrl, serviceKey, email) {
  for (let page = 1; page <= 50; page += 1) {
    const response = await authAdmin(fetchImpl, apiUrl, serviceKey, `users?page=${page}&per_page=200`);
    if (!response.ok) return null;
    const { users = [] } = await response.json();
    const match = users.find((user) => String(user.email ?? "").toLowerCase() === email);
    if (match) return match.id;
    if (users.length < 200) return null;
  }
  return null;
}

/**
 * Creates the account in the API's instance (confirmed email) and promotes THAT account, by the UUID Auth returned, in the database.
 * If the promotion does not find that UUID in the database, the two are not the same instance: it fails, it never reports success.
 * `runSql(sql, { uid })` runs the statement with psql variable `uid` and returns its output.
 */
export async function createLocalSuperadmin({ apiUrl, serviceKey, email, password, fullName, fetchImpl, runSql }) {
  const [firstName, ...rest] = fullName.split(/\s+/);
  const response = await authAdmin(fetchImpl, apiUrl, serviceKey, "users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName, first_name: firstName, last_name: rest.join(" ") || "Local", phone: "+56911112222", terms_accepted: true, account_type: "customer" } }),
  });
  let userId;
  let created = false;
  if (response.ok) { userId = (await response.json()).id; created = true; }
  else {
    const text = await response.text();
    if (!(response.status === 422 || /already|registered|exists/i.test(text))) throw new Error(`Supabase rechazó la creación (HTTP ${response.status}).`);
    userId = await findUserId(fetchImpl, apiUrl, serviceKey, email);
  }
  if (typeof userId !== "string" || !UUID.test(userId)) throw new Error("No se pudo obtener el identificador de la cuenta desde Supabase Auth.");

  const out = runSql("update public.profiles set role = 'superadmin', account_status = 'active' where id = :'uid'::uuid returning id, role, account_status;", { uid: userId }).trim();
  if (!out.toLowerCase().startsWith(userId.toLowerCase())) {
    throw new Error("La cuenta existe en la API pero no en la base del contenedor indicado: no son la misma instancia. No se promovió nada.");
  }
  return { created, userId, summary: out.split(/\r?\n/)[0] };
}
