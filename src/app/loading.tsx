import { SiteHeader } from "@/components/layout/site-header";
import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main className="container py-10 pb-28">
        <LoadingRegion>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <SkeletonCard key={item} />)}</div>
        </LoadingRegion>
      </main>
    </>
  );
}
