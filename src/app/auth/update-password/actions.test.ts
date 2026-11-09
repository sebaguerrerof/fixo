import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";
import { updatePassword } from "./actions";
const mocks=vi.hoisted(()=>({check:vi.fn(),update:vi.fn(),rpc:vi.fn(),logout:vi.fn(),redirect:vi.fn()}));
vi.mock("@/services/auth/auth-flow-service",()=>({checkPasswordFlow:mocks.check}));
vi.mock("@/integrations/supabase/server-client",()=>({getSupabaseServerClient:async()=>({auth:{updateUser:mocks.update,signOut:mocks.logout},rpc:mocks.rpc})}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{mocks.redirect(url);throw new Error("REDIRECT");}}));
beforeEach(()=>{mocks.check.mockResolvedValue("recovery");mocks.update.mockResolvedValue({error:null});mocks.logout.mockResolvedValue({error:null});mocks.rpc.mockResolvedValue({data:{account_status:"active",allowed:true,invitation_pending:false},error:null});});
afterEach(()=>vi.resetAllMocks());
function form(extra:Record<string,string>={}){const data=new FormData();for(const[k,v]of Object.entries({password:"Local-password-123",confirmPassword:"Local-password-123",...extra}))data.set(k,v);return data;}
describe("password completion",()=>{
  it("requires an unexpired one-time recovery proof",async()=>{mocks.check.mockResolvedValue(null);await expect(updatePassword(form())).rejects.toThrow("REDIRECT");expect(mocks.update).not.toHaveBeenCalled();});
  it("validates password confirmation before consuming a proof",async()=>{await expect(updatePassword(form({confirmPassword:"different"}))).rejects.toThrow("REDIRECT");expect(mocks.check).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled();});
  it("consumes the proof before updating and revokes all sessions",async()=>{await expect(updatePassword(form())).rejects.toThrow("REDIRECT");expect(mocks.check.mock.calls).toEqual([[false],[true]]);expect(mocks.update).toHaveBeenCalledWith({password:"Local-password-123"});expect(mocks.logout).toHaveBeenCalledWith({scope:"global"});expect(mocks.redirect).toHaveBeenCalledWith("/login?password=updated");});
  it("checks current status again before using an earlier proof",async()=>{mocks.rpc.mockResolvedValue({data:{account_status:"blocked",allowed:false}});await expect(updatePassword(form())).rejects.toThrow("REDIRECT");expect(mocks.update).not.toHaveBeenCalled();});
  it("does not update if a concurrent request consumed the proof",async()=>{mocks.check.mockResolvedValueOnce("recovery").mockResolvedValueOnce(null);await expect(updatePassword(form())).rejects.toThrow("REDIRECT");expect(mocks.update).not.toHaveBeenCalled();});
  it("requires invitation profile and consent",async()=>{mocks.check.mockResolvedValue("invite");await expect(updatePassword(form())).rejects.toThrow("REDIRECT");expect(mocks.update).not.toHaveBeenCalled();});
  it("completes a pending invitation only after password success",async()=>{mocks.check.mockResolvedValue("invite");mocks.rpc.mockResolvedValue({data:{account_status:"active",invitation_pending:true},error:null});await expect(updatePassword(form({firstName:"Local",lastName:"Invite",phone:"+56912345678",acceptTerms:"on"}))).rejects.toThrow("REDIRECT");expect(mocks.rpc).toHaveBeenCalledWith("accept_my_invitation",expect.objectContaining({terms_accepted:true,first_name:"Local"}));expect(mocks.logout).toHaveBeenCalled();});
});
