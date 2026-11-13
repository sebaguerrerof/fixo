import { describe,it,expect,afterEach,vi } from "vitest";
import { PDFDocument,PDFName,PDFString } from "pdf-lib";
import sharp from "sharp";
import { professionalDraftSchema,requirementInputSchema } from "./application";
import { inspectContent,inspectDocument } from "../../../scripts/lib/inspect-document.mjs";
const draft={city:"Ñuñoa",headline:"Servicios profesionales",bio:"Experiencia declarada",coverage:["Ñuñoa"],categories:["electricidad"],primaryCategory:"electricidad",specialties:[],years:5,price:25000,availability:"Lunes a viernes",portfolio:[]};
afterEach(()=>vi.unstubAllEnvs());
describe("professional application boundaries",()=>{
 it("rejects privilege overposting and mismatched primary category",()=>{
  expect(professionalDraftSchema.safeParse({...draft,status:"active"}).success).toBe(false);
  expect(professionalDraftSchema.safeParse({...draft,primaryCategory:"gasfiteria"}).success).toBe(false);
 });
 it.each(["javascript:alert(1)","https://user:password@example.invalid/file","http://example.invalid"])("rejects unsafe portfolio URL %s",url=>expect(professionalDraftSchema.safeParse({...draft,portfolio:[url]}).success).toBe(false));
 it("requires a source for legal requirements and keeps optional information optional",()=>{
  const base={category:"electricidad",key:"antecedente",requirement_kind:"legal",is_required:true,document_kind:"license",description:"Requisito declarado",source_url:null,reason:"Motivo de configuración"};
  expect(requirementInputSchema.safeParse(base).success).toBe(false);
  expect(requirementInputSchema.safeParse({...base,requirement_kind:"optional"}).success).toBe(false);
  expect(requirementInputSchema.safeParse({...base,requirement_kind:"internal"}).success).toBe(true);
 });
});
describe("actual file content validation",()=>{
 it("rejects HTML disguised as PDF and truncated image bytes",async()=>{
  await expect(inspectContent(Buffer.from("<html>not a PDF</html>"))).rejects.toThrow();
  await expect(inspectContent(Buffer.from([137,80,78,71,13,10,26,10,0,0]))).rejects.toThrow();
 });
 it("parses a real PDF and rejects active document actions",async()=>{
  const pdf=await PDFDocument.create();pdf.addPage();const valid=Buffer.from(await pdf.save());
  expect(await inspectContent(valid)).toBe("application/pdf");
  pdf.catalog.set(PDFName.of("OpenAction"),pdf.context.obj({S:PDFName.of("JavaScript"),JS:PDFString.of("app.alert('synthetic')")}));
  await expect(inspectContent(Buffer.from(await pdf.save()))).rejects.toThrow("contenido activo");
 });
 it("fully decodes a real PNG",async()=>{
  const png=await sharp({create:{width:2,height:2,channels:3,background:"white"}}).png().toBuffer();
  expect(await inspectContent(png)).toBe("image/png");
 });
 it("never reports clean when the antivirus is unavailable or MIME is forged",async()=>{
  const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
  vi.stubEnv("FIXO_CLAMSCAN_PATH","");vi.stubEnv("FIXO_CLAMAV_DATABASE_DIR","");
  expect((await inspectDocument(bytes,"application/pdf")).result).toBe("error");
  expect((await inspectDocument(bytes,"image/png")).result).toBe("unsafe");
 });
});
