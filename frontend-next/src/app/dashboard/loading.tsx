import { Skeleton } from "@/components/ui/skeleton";
import { messages as m } from "@/lib/messages";
export default function Loading() {
  return (
    <div role="status" aria-label={m.loading} className="flex flex-col gap-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <span className="sr-only">{m.loading}</span>
    </div>
  );
}
