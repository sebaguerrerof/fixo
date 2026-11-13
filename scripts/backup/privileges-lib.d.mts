export const SNAPSHOT_VERSION: number;
export const SNAPSHOT_KIND: string;
export const SNAPSHOT_SCHEMAS: string[];
export const SNAPSHOT_ROLES: string[];
export const SNAPSHOT_QUERY: string;
export const SNAPSHOT_SQL: string;
export interface PrivilegeRow { k: "sch" | "fn" | "rel" | "seq"; o: string; acl: string }
export interface PrivilegeSnapshot { kind: string; version: number; takenAt: string; project: string; schemas: string[]; roles: string[]; counts: Record<string, number>; digest: string; rows: PrivilegeRow[] }
export function buildSnapshotDoc(rows: PrivilegeRow[], options: { project: string; takenAt?: string }): PrivilegeSnapshot;
export function parseSnapshot(doc: unknown): PrivilegeRow[];
export function parseAllowExtra(list: unknown): string[];
export function buildReconcileSql(doc: unknown, options?: { verifyOnly?: boolean; allowExtra?: string[] }): string;
