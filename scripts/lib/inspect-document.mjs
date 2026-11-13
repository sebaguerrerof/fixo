import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, stat, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep, isAbsolute } from "node:path";
import { PDFDocument, PDFName } from "pdf-lib";
import sharp from "sharp";
const exec = promisify(execFile);

/** Parses actual bytes; never trusts the browser MIME or file extension. */
export async function inspectContent(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 8 || bytes.length > 10485760) throw new Error("Tamaño de documento inválido");
  if (bytes.subarray(0, 5).toString() === "%PDF-") {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, throwOnInvalidObject: true });
    if (pdf.getPageCount() < 1 || pdf.getPageCount() > 100) throw new Error("PDF fuera de límites");
    const forbidden = new Set(["JavaScript", "JS", "Launch", "OpenAction", "AA", "EmbeddedFiles", "EmbeddedFile", "RichMedia", "XFA", "AcroForm"]);
    // PDF names are decoded by the parser, including hexadecimal escapes.
    for (const [, object] of pdf.context.enumerateIndirectObjects()) {
      const serialized = object.toString();
      for (const token of serialized.matchAll(/\/((?:#[0-9a-fA-F]{2}|[^\s<>\[\]()/%])*)/g)) {
        if (forbidden.has(PDFName.of(token[1]).decodeText())) throw new Error("PDF con contenido activo o adjunto");
      }
    }
    return "application/pdf";
  }
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!png && !jpeg) throw new Error("Formato de documento no permitido");
  const image = sharp(bytes, { limitInputPixels: 30000000, failOn: "warning", animated: false });
  const metadata = await image.metadata();
  if (metadata.format !== (png ? "png" : "jpeg") || !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) throw new Error("Imagen inválida");
  await image.raw().toBuffer(); // Full decode catches truncated/corrupt image payloads.
  return png ? "image/png" : "image/jpeg";
}

/** Actual ClamAV invocation. Missing/stale signatures, crashes and timeouts fail closed. */
export async function inspectDocument(bytes, declaredMime) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let mime;
  try { mime = await inspectContent(bytes); if (mime !== declaredMime) throw new Error("MIME discordante"); }
  catch { return { sha256, mime: null, size: bytes.length, result: "unsafe", engine: "Fixo binary parser v1 (content rejected)" }; }
  const binary = process.env.FIXO_CLAMSCAN_PATH, database = process.env.FIXO_CLAMAV_DATABASE_DIR;
  if (!binary || !database || !isAbsolute(binary) || !isAbsolute(database)) return { sha256, mime, size: bytes.length, result: "error", engine: "ClamAV unavailable" };
  const tempRoot = resolve(tmpdir());
  let directory;
  try {
    const daily = (await readdir(database)).find(name => /^daily\.(cvd|cld)$/.test(name));
    if (!daily || Date.now() - (await stat(resolve(database, daily))).mtimeMs > 48 * 3600000) throw new Error("Stale signatures");
    const version = (await exec(binary, ["--version"], { timeout: 10000, windowsHide: true, maxBuffer: 4096 })).stdout.trim();
    if (!/^ClamAV \d/.test(version)) throw new Error("Unexpected scanner");
    directory = await mkdtemp(resolve(tempRoot, "fixo-inspection-"));
    const file = resolve(directory, "document.bin");
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
    const args = ["--database=" + database, "--max-filesize=11M", "--max-scansize=30M", "--max-recursion=10", "--alert-exceeds-max=yes", "--no-summary", "--stdout", file];
    try {
      const result = await exec(binary, args, { timeout: 120000, windowsHide: true, maxBuffer: 16384 });
      if (!result.stdout.includes(": OK")) throw new Error("Incomplete scan");
      return { sha256, mime, size: bytes.length, result: "clean", engine: version.slice(0, 200) };
    } catch (error) {
      return { sha256, mime, size: bytes.length, result: error.code === 1 && error.stdout?.includes("FOUND") ? "unsafe" : "error", engine: version.slice(0, 200) };
    }
  } catch { return { sha256, mime, size: bytes.length, result: "error", engine: "ClamAV unavailable or signatures stale" }; }
  finally {
    // The only recursive deletion targets the unique directory created just above.
    if (directory && resolve(directory).startsWith(tempRoot + sep + "fixo-inspection-")) await rm(directory, { recursive: true, force: true });
  }
}
