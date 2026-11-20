import { describe, expect, it, vi } from "vitest";

import { assertSameLocalStack, createLocalSuperadmin, readLocalEnv } from "./local-admin-lib.mjs";

const ID = "11111111-2222-4333-8444-555555555555";
const OTHER_ID = "99999999-8888-4777-8666-555555555555";
const KEY = "service-role-key-value";
const API = "http://127.0.0.1:57321";
const publishes = (port) => vi.fn(() => `0.0.0.0:${port}\n[::]:${port}\n`);

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe("reading the env file (dotenv format)", () => {
  it("handles quotes, spaces around =, comments, export and blank lines", () => {
    const env = readLocalEnv([
      "# local stack", "", `NEXT_PUBLIC_SUPABASE_URL="${API}"`, `SUPABASE_SERVICE_ROLE_KEY = '${KEY}'`, "export FIXO_APP_URL=http://127.0.0.1:3000 # origin", "NEXT_PUBLIC_DEMO_MODE=false",
    ].join("\n"));
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(API);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(KEY);
    expect(env.FIXO_APP_URL).toBe("http://127.0.0.1:3000");
  });

  it("a quoted local URL is accepted as local, and the key is used without its quotes", () => {
    const env = readLocalEnv(`NEXT_PUBLIC_SUPABASE_URL="${API}"\nSUPABASE_SERVICE_ROLE_KEY="${KEY}"\n`);
    expect(assertSameLocalStack({ env, container: "supabase_db_fixo", run: publishes(57321) })).toEqual({ apiUrl: API, serviceKey: KEY });
  });
});

describe("one local stack, checked before anything is written", () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: API, SUPABASE_SERVICE_ROLE_KEY: KEY };

  it("rejects an API that is not local", () => {
    expect(() => assertSameLocalStack({ env: { ...env, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" }, container: "supabase_db_fixo", run: publishes(57321) })).toThrow(/no es local/);
  });

  it("rejects a database container that belongs to a different stack than the API", () => {
    // The API on :57321 is Fixo's kong; the configured container is another project's database.
    const run = vi.fn((_command, args) => (args[1] === "supabase_kong_fixo" ? "0.0.0.0:57321" : "0.0.0.0:55321"));
    expect(() => assertSameLocalStack({ env, container: "supabase_db_sbtest", run })).toThrow(/misma instancia/);
    expect(run).toHaveBeenCalledWith("docker", ["port", "supabase_kong_sbtest", "8000/tcp"]);
  });

  it("rejects when the stack's ports are not published (the Docker/Windows problem) or the container name is unexpected", () => {
    expect(() => assertSameLocalStack({ env, container: "supabase_db_fixo", run: () => "" })).toThrow(/misma instancia/);
    expect(() => assertSameLocalStack({ env, container: "supabase_db_fixo", run: () => { throw new Error("no such container"); } })).toThrow(/misma instancia/);
    expect(() => assertSameLocalStack({ env, container: "postgres", run: publishes(57321) })).toThrow(/supabase_db_/);
  });

  it("requires the service key", () => {
    expect(() => assertSameLocalStack({ env: { NEXT_PUBLIC_SUPABASE_URL: API }, container: "supabase_db_fixo", run: publishes(57321) })).toThrow(/SERVICE_ROLE_KEY/);
  });
});

describe("creating and promoting the same account", () => {
  const base = { apiUrl: API, serviceKey: KEY, email: "admin@example.com", password: "Clave-Segura-123", fullName: "Sebastian Guerrero" };

  it("promotes by the UUID that Auth returned, never by email", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: ID }));
    const runSql = vi.fn(() => `${ID}|superadmin|active\nUPDATE 1`);
    const result = await createLocalSuperadmin({ ...base, fetchImpl, runSql });
    expect(result).toMatchObject({ created: true, userId: ID, summary: `${ID}|superadmin|active` });
    const [sql, vars] = runSql.mock.calls[0];
    expect(vars).toEqual({ uid: ID });
    expect(sql).toContain(":'uid'::uuid");
    expect(sql).not.toContain("admin@example.com");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${API}/auth/v1/admin/users`);
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(init.body)).toMatchObject({ email: "admin@example.com", email_confirm: true, user_metadata: { first_name: "Sebastian", last_name: "Guerrero", account_type: "customer" } });
  });

  it("fails, and reports no success, when the account is not in the database it is promoting in (two different instances)", async () => {
    // Another stack has a profile with the same email but a different UUID; the UUID from this API is not in the container.
    const runSql = vi.fn(() => "UPDATE 0");
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: ID }));
    await expect(createLocalSuperadmin({ ...base, fetchImpl, runSql })).rejects.toThrow(/no son la misma instancia/);
    const wrongProfile = vi.fn(() => `${OTHER_ID}|superadmin|active`);
    await expect(createLocalSuperadmin({ ...base, fetchImpl, runSql: wrongProfile })).rejects.toThrow(/no son la misma instancia/);
  });

  it("an existing account keeps its password: its UUID is found through the admin API and that one is promoted", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (init?.method === "POST") return jsonResponse(422, { msg: "A user with this email address has already been registered" });
      return jsonResponse(200, { users: [{ id: OTHER_ID, email: "otro@example.com" }, { id: ID, email: "Admin@Example.com" }] });
    });
    const runSql = vi.fn(() => `${ID}|superadmin|active`);
    expect(await createLocalSuperadmin({ ...base, fetchImpl, runSql })).toMatchObject({ created: false, userId: ID });
    expect(runSql.mock.calls[0][1]).toEqual({ uid: ID });
  });

  it("does not promote anything when Auth gives no usable identifier, or refuses the creation", async () => {
    const runSql = vi.fn();
    await expect(createLocalSuperadmin({ ...base, fetchImpl: async () => jsonResponse(200, { id: "not-a-uuid" }), runSql })).rejects.toThrow(/identificador/);
    await expect(createLocalSuperadmin({ ...base, fetchImpl: async () => jsonResponse(500, {}), runSql })).rejects.toThrow(/HTTP 500/);
    await expect(createLocalSuperadmin({ ...base, fetchImpl: async (_url, init) => (init?.method === "POST" ? jsonResponse(422, { msg: "already registered" }) : jsonResponse(200, { users: [] })), runSql })).rejects.toThrow(/identificador/);
    expect(runSql).not.toHaveBeenCalled();
  });
});
