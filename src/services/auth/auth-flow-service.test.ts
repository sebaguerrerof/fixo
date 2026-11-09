import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { checkPasswordFlow,issuePasswordFlow,allowAuthAttempt,flowHash } from "./auth-flow-service";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({get:vi.fn(),set:vi.fn(),remove:vi.fn(),rpc:vi.fn(),adminRpc:vi.fn(),identity:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:mocks.get,set:mocks.set,delete:mocks.remove})}));
vi.mock("@/integrations/supabase/admin-client",()=>({getSupabaseAdminClient:()=>({rpc:mocks.adminRpc})}));
vi.mock("@/integrations/supabase/server-client",()=>({getSupabaseServerClient:async()=>({rpc:mocks.rpc,auth:{getUser:mocks.identity}})}));
beforeEach(()=>{mocks.identity.mockResolvedValue({data:{user:{id:"local"}}});mocks.get.mockReturnValue({value:"t".repeat(43)});});
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();});
describe("one-time password proof boundary",()=>{
  it("stores only a hash in the database and an HttpOnly short-lived cookie",async()=>{vi.stubEnv("NODE_ENV","production");mocks.adminRpc.mockResolvedValue({error:null});const claims=Buffer.from(JSON.stringify({session_id:"10000000-0000-4000-8000-000000000001"})).toString("base64url");await issuePasswordFlow({user:{id:"local"},access_token:"header."+claims+".verified"} as Session,"recovery");const cookie=mocks.set.mock.calls[0];expect(cookie[2]).toMatchObject({httpOnly:true,secure:true,sameSite:"lax",maxAge:900,path:"/auth"});expect(mocks.adminRpc.mock.calls[0][1].flow_hash).toBe(flowHash(cookie[1]));expect(mocks.adminRpc.mock.calls[0][1].flow_hash).not.toBe(cookie[1]);});
  it("does not set a cookie if proof persistence fails",async()=>{mocks.adminRpc.mockResolvedValue({error:{message:"unavailable"}});const claims=Buffer.from(JSON.stringify({session_id:"session"})).toString("base64url");await expect(issuePasswordFlow({user:{id:"local"},access_token:"h."+claims+".verified"} as Session,"invite")).rejects.toThrow();expect(mocks.set).not.toHaveBeenCalled();});
  it("rejects a missing cookie without querying",async()=>{mocks.get.mockReturnValue(undefined);expect(await checkPasswordFlow()).toBeNull();expect(mocks.rpc).not.toHaveBeenCalled();});
  it("rejects expired or mismatched-session proofs",async()=>{mocks.rpc.mockResolvedValue({data:null,error:{code:"42501"}});expect(await checkPasswordFlow()).toBeNull();expect(mocks.remove).not.toHaveBeenCalled();});
  it("consumes atomically through the user JWT and clears the cookie",async()=>{mocks.rpc.mockResolvedValue({data:"recovery",error:null});expect(await checkPasswordFlow(true)).toBe("recovery");expect(mocks.rpc).toHaveBeenCalledWith("check_auth_flow",{flow_hash:flowHash("t".repeat(43)),consume:true});expect(mocks.remove).toHaveBeenCalledWith("fixo_auth_flow");});
  it("rate limits with a normalized hashed key and fails closed",async()=>{mocks.adminRpc.mockResolvedValue({data:false,error:null});expect(await allowAuthAttempt("recover"," Test@Example.invalid ",3)).toBe(false);expect(mocks.adminRpc.mock.calls[0][1].rate_key).toBe("recover:"+flowHash("test@example.invalid"));});
});
