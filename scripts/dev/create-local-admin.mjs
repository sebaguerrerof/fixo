// Creates (or promotes) a REAL superadmin account in the LOCAL Docker Supabase stack. Development only.
//   npm run local:create-admin -- admin@fixo.local [Nombre Apellido]     (also accepts --name "Nombre Apellido")
// Run it in a normal terminal (PowerShell / Git Bash), NOT through Claude Code's "!" prefix: the password is asked on the
// keyboard without echo, or read from FIXO_LOCAL_ADMIN_PASSWORD; it is never printed or stored.
// Roles can never come from sign-up metadata (by design), so the account is created confirmed and then promoted in the local DB.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { assertSameLocalStack, createLocalSuperadmin, readLocalEnv } from "./local-admin-lib.mjs";

const container = process.env.FIXO_LOCAL_DB_CONTAINER ?? "supabase_db_fixo";
const args = process.argv.slice(2).filter((arg) => arg !== "--" && arg !== "--name");
const email = (args.find((arg) => arg.includes("@")) ?? "").trim().toLowerCase();
// Every other plain word is the name; default "Admin Local".
const fullName = args.filter((arg) => !arg.includes("@") && !arg.startsWith("--")).join(" ").trim() || "Admin Local";

function fail(message) { console.error(`\n${message}\n`); process.exit(1); }
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail("Uso: npm run local:create-admin -- correo@ejemplo.com [Nombre Apellido]");
if (fullName.length < 2 || fullName.length > 120) fail("El nombre debe tener entre 2 y 120 caracteres.");

// Local only, and ONE stack: the API in .env.development.local and the database container must be the same Supabase instance.
const envFile = ".env.development.local";
if (!existsSync(envFile)) fail(`No existe ${envFile}. Primero configura el entorno local (Supabase en Docker).`);
const run = (command, commandArgs) => execFileSync(command, commandArgs, { encoding: "utf8" });
let target;
try { target = assertSameLocalStack({ env: readLocalEnv(readFileSync(envFile, "utf8")), container, run }); }
catch (error) { fail(error.message); }

function askPassword() {
  if (process.env.FIXO_LOCAL_ADMIN_PASSWORD) return Promise.resolve(process.env.FIXO_LOCAL_ADMIN_PASSWORD);
  if (!process.stdin.isTTY) {
    fail([
      "Este comando necesita una terminal interactiva para pedir la contraseña sin mostrarla.",
      "Ejecútalo en una ventana normal de PowerShell o Git Bash, no con el prefijo ! de Claude Code (no es interactivo).",
    ].join("\n"));
  }
  return new Promise((resolve) => {
    let typed = "";
    process.stdout.write("Contraseña del administrador (no se muestra): ");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const finish = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", onData); process.stdout.write("\n"); };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") { finish(); return resolve(typed); }
        if (char === "\u0003") { finish(); process.exit(130); }
        if (char === "\u007f" || char === "\b") typed = typed.slice(0, -1);
        else if (char >= " ") typed += char;
      }
    };
    process.stdin.on("data", onData);
  });
}
const password = await askPassword();
if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  fail("La contraseña debe tener al menos 12 caracteres, una mayúscula, una minúscula y un número.");
}

const runSql = (sql, vars) => execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-tA", ...Object.entries(vars).flatMap(([key, value]) => ["-v", `${key}=${value}`])], { input: sql, encoding: "utf8" });
try {
  const result = await createLocalSuperadmin({ ...target, email, password, fullName, fetchImpl: fetch, runSql });
  console.log(result.created ? "Cuenta creada y con el correo ya confirmado." : "La cuenta ya existía: se mantiene su contraseña y solo se asegura el rol.");
  console.log(`Listo: ${email} es superadmin (${result.summary}). Inicia sesión en la app local con ese correo (la contraseña es la que definiste al crear la cuenta).`);
} catch (error) {
  fail(error.cause?.code === "ECONNREFUSED" || error instanceof TypeError
    ? `No se pudo conectar con Supabase local en ${target.apiUrl} (${error.cause?.code ?? error.message}).\nRevisa que Docker haya publicado los puertos: \`docker port supabase_kong_fixo\` debe mostrar 8000/tcp -> ...:57321.`
    : error.message);
}
