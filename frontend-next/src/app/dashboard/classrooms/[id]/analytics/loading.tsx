import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-60" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
