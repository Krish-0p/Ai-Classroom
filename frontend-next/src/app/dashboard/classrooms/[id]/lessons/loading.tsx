import { Skeleton } from "@/components/ui/skeleton";
import { lessonMessages as m } from "@/lib/lesson-messages";
export default function LoadingLessons() {
  return (
    <div role="status" className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{m.loading}</p>
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
