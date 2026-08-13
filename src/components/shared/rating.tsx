import { Star } from "lucide-react";

interface RatingProps {
  readonly rating: number;
  readonly reviewCount?: number;
}

export function Rating({ rating, reviewCount }: RatingProps) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      {rating > 0 ? rating.toFixed(1) : "Nuevo"}
      {reviewCount !== undefined && reviewCount > 0 ? <span className="font-normal text-muted-foreground">({reviewCount})</span> : null}
    </span>
  );
}
