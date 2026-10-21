import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readAnalytics } from "@/server/analytics";
import { AppError } from "@/server/errors";
import { AnalyticsDashboard } from "@/features/analytics/dashboard";
import { analyticsMessages as m } from "@/lib/analytics-messages";
import { WorkspacePageHeader } from "@/components/workspace/page-header";
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
      <div className="learning-page">
        <Link
          className="text-sm underline"
          href={`/dashboard/classrooms/${id}`}
        >
          {m.back}
        </Link>
        <WorkspacePageHeader title={m.title} description={m.description} />
        <AnalyticsDashboard data={data} classroomId={id} />
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.status))
      notFound();
    throw error;
  }
}
