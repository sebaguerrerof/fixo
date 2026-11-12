export interface CostRow { id: string; cost: number | null }
export function runCostCorrection(deps: {
  rows: CostRow[];
  getCost: (row: CostRow) => Promise<number | null>;
  readCost: (id: string) => Promise<number | null>;
  applyUpdate: (id: string, from: number | null, to: number) => Promise<Array<{ flow_cost_clp: number | null }>>;
  load: () => Promise<any>;
  save: (m: any) => Promise<void>;
  now?: () => string;
}): Promise<{ applied: number; recovered: number; skipped: number; conflicts: number }>;
