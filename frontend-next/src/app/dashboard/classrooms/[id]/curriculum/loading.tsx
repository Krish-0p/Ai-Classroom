import { Skeleton } from "@/components/ui/skeleton";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
export default function LoadingCurriculum() {
  return (
    <div role="status" className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{m.loading}</p>
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
