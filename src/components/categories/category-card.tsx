import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CategoryIcon } from "@/components/categories/category-icon";
import { Card, CardContent } from "@/components/ui/card";
import type { Category } from "@/domain/entities/category";

export function CategoryCard({ category }: { readonly category: Category }) {
  return (
    <Link className="block" href={`/tecnicos?categoria=${category.id}`}>
      <Card className="group h-full transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft">
        <CardContent className="p-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CategoryIcon name={category.icon} /></div>
          <h3 className="mt-4 font-bold text-foreground">{category.name}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{category.description}</p>
          <div className="mt-4 flex items-center justify-between text-sm font-semibold text-primary"><span>{category.technicianCount} disponibles</span><ArrowRight className="size-4 transition group-hover:translate-x-1" /></div>
        </CardContent>
      </Card>
    </Link>
  );
}
