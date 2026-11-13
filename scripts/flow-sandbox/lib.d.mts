export const MANIFEST_PATH: string;
export const manifestPath: () => string;
export function readManifest(): Promise<any | null>;
export function writeManifest(m: unknown): Promise<void>;
export function lockManifest(options?: { waitMs?: number }): Promise<() => Promise<void>>;
export function withManifestLock<T>(fn: () => Promise<T> | T, options?: { waitMs?: number }): Promise<T>;
export function updateManifest<T>(mutate: (m: any) => Promise<T> | T, options?: { waitMs?: number }): Promise<T | undefined>;
