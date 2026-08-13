export type CategoryIcon =
  | "bolt"
  | "droplets"
  | "key-round"
  | "snowflake"
  | "monitor-cog"
  | "wrench"
  | "paint-roller"
  | "sprout";

export interface Category {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly icon: CategoryIcon;
  readonly technicianCount: number;
}

export interface Specialty {
  readonly id: string;
  readonly categoryId: string;
  readonly name: string;
}
