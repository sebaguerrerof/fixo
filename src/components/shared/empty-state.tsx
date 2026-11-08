import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title, description }: { readonly title: string; readonly description: string }) {
  return <Card><CardContent className="py-10 text-center"><h2 className="text-lg font-semibold">{title}</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p></CardContent></Card>;
}
