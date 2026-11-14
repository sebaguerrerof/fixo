import { SiteHeader } from "@/components/layout/site-header";
import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function TechniciansLoading() {
  return (
    <>
      <SiteHeader />
      <main className="container pb-14 pt-10 lg:pt-16">
        <LoadingRegion label="Cargando técnicos">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-9 w-80 max-w-full" />
          <Skeleton className="mt-8 h-16 w-full rounded-2xl" />
          <div className="mt-6 flex gap-2 overflow-hidden">{[1, 2, 3, 4, 5].map((item) => <Skeleton className="h-10 w-28 shrink-0 rounded-lg" key={item} />)}</div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <SkeletonCard key={item} />)}</div>
        </LoadingRegion>
      </main>
    </>
  );
}
