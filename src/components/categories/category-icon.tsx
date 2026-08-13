import { Bolt, Droplets, KeyRound, MonitorCog, PaintRoller, Snowflake, Sprout, Wrench, type LucideIcon } from "lucide-react";

import type { CategoryIcon as CategoryIconName } from "@/domain/entities/category";

const icons: Record<CategoryIconName, LucideIcon> = {
  bolt: Bolt,
  droplets: Droplets,
  "key-round": KeyRound,
  snowflake: Snowflake,
  "monitor-cog": MonitorCog,
  wrench: Wrench,
  "paint-roller": PaintRoller,
  sprout: Sprout,
};

export function CategoryIcon({ name }: { readonly name: CategoryIconName }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className="size-5" />;
}
