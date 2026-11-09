import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { prepareRequestPhoto } from "./prepare-request-photo";
describe("private request photo boundary", () => {
  it("decodes PNG, strips metadata and emits a bounded JPEG", async () => {
    const source = await sharp({ create: { width: 2400, height: 100, channels: 3, background: "blue" } }).withMetadata().png().toBuffer();
    const result = await prepareRequestPhoto(source); const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe("jpeg"); expect(metadata.width).toBe(2000); expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
  });
  it.each([Buffer.from("<html>disguised image</html>"), Buffer.from("%PDF-1.7 fake jpeg"), Buffer.alloc(4194305), Buffer.alloc(1)])("rejects invalid or oversized content", async bytes => { await expect(prepareRequestPhoto(bytes)).rejects.toThrow(); });
});
