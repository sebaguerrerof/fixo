import sharp from "sharp";
/** Decode/re-encode approved raster formats and strip all EXIF/GPS metadata. */
export async function prepareRequestPhoto(bytes: Buffer): Promise<Buffer> {
  if (bytes.length < 8 || bytes.length > 4194304) throw new Error("Fotografía fuera de límites");
  const image = sharp(bytes, { limitInputPixels: 16000000, failOn: "warning", animated: false });
  const metadata = await image.metadata();
  if (!["jpeg", "png"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1) throw new Error("Formato no permitido");
  const safe = await image.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  if (safe.length > 4194304) throw new Error("Fotografía fuera de límites");
  return safe;
}
