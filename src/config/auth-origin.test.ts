import { afterEach,describe,expect,it,vi } from "vitest";
import { getAuthOrigin } from "./auth-origin";
afterEach(()=>vi.unstubAllEnvs());
describe("Auth origin configuration",()=>{
  it.each(["https://soyfixo.cl","http://127.0.0.1:3000","http://localhost:3000"])("accepts exact configured origin %s",origin=>{vi.stubEnv("FIXO_APP_URL",origin);expect(getAuthOrigin()).toBe(origin);});
  it.each(["http://evil.invalid","https://user:pass@soyfixo.cl","https://soyfixo.cl/redirect","https://soyfixo.cl/?next=evil","https://soyfixo.cl/#token"])("rejects invalid origin %s",origin=>{vi.stubEnv("FIXO_APP_URL",origin);expect(()=>getAuthOrigin()).toThrow();});
  it("requires explicit origin",()=>{vi.stubEnv("FIXO_APP_URL",undefined);expect(()=>getAuthOrigin()).toThrow();});
});
