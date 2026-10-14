import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readAnalytics } from "@/server/analytics";
import { AppError } from "@/server/errors";
import { AnalyticsDashboard } from "@/features/analytics/dashboard";
import { analyticsMessages as m } from "@/lib/analytics-messages";
export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageActor();
  const { id } = await params;
  try {
    const data = await readAnalytics(actor, id);
    return (
      <div className="flex flex-col gap-6">
        <Link
          className="text-sm underline"
          href={`/dashboard/classrooms/${id}`}
        >
          {m.back}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{m.title}</h1>
        <AnalyticsDashboard data={data} classroomId={id} />
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.status))
      notFound();
    throw error;
  }
}
