import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { readAssessment } from "@/server/assessments";
import { assessmentAttempts } from "@/server/attempts";
import { lessonConcepts } from "@/server/lessons";
import { AppError } from "@/server/errors";
import { AssessmentEditor } from "@/features/assessments/editor";
import { StartAttemptButton } from "@/features/assessments/actions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { assessmentMessages as m } from "@/lib/assessment-messages";
import { WorkspacePageHeader } from "@/components/workspace/page-header";
import { SectionTabs } from "@/components/workspace/section-tabs";
export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  const actor = await requirePageActor();
  const { id, assessmentId } = await params;
  let classroom: Awaited<ReturnType<typeof readClassroom>>;
  let assessment: Awaited<ReturnType<typeof readAssessment>>;
  try {
    classroom = await readClassroom(actor, id);
    assessment = await readAssessment(actor, id, assessmentId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const concepts =
    actor.role === "teacher" ? await lessonConcepts(actor, id) : [];
  const attempts =
    actor.role === "teacher"
      ? await assessmentAttempts(actor, id, assessmentId)
      : [];
  return (
    <div className="learning-page">
      <Link
        href={`/dashboard/classrooms/${id}/assessments`}
        className="text-sm underline underline-offset-4"
      >
        {m.back}
      </Link>
      <WorkspacePageHeader
        title={
          assessment.kind === "teacher"
            ? assessment.document.title
            : assessment.title
        }
        eyebrow={classroom.name}
        description={actor.role === "teacher" ? m.teacherHelp : m.studentHelp}
      />
      {classroom.status === "archived" && <p role="status">{m.readonly}</p>}
      {assessment.kind === "teacher" ? (
        <SectionTabs
          label={m.title}
          sections={[
            {
              id: "studio",
              label: m.studio,
              content: (
                <AssessmentEditor
                  key={`${assessment.id}-${assessment.job?.status === "complete" ? assessment.job.id : "manual"}`}
                  classroomId={id}
                  assessmentId={assessmentId}
                  initial={assessment.document}
                  initialVersion={assessment.version}
                  publishedVersion={assessment.publishedVersion}
                  status={assessment.status}
                  initialJob={assessment.job}
                  concepts={concepts}
                  disabled={classroom.status === "archived"}
                />
              ),
            },
            {
              id: "review",
              label: m.review,
              content: (
                <section className="flex flex-col gap-4">
                  <h2 className="text-xl font-semibold">{m.review}</h2>
                  <p className="text-sm text-muted-foreground">
                    {m.reviewIntro}
                  </p>
                  {attempts.length ? (
                    <ul className="flex flex-col gap-3">
                      {attempts.map((attempt) => (
                        <li
                          key={attempt.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                        >
                          <span>
                            {attempt.student.name} · {m.attempt}{" "}
                            {attempt.number} · {attempt.score.toFixed(2)} /{" "}
                            {attempt.maximumScore} ·{" "}
                            {attempt.pendingReview ? m.pending : m.complete}
                          </span>
                          <Link
                            className="text-sm underline underline-offset-4"
                            href={`/dashboard/classrooms/${id}/attempts/${attempt.id}`}
                          >
                            {m.review}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty className="border">
                      <EmptyHeader>
                        <EmptyTitle>{m.emptyAttempts}</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  )}
                </section>
              ),
            },
          ]}
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{m.instructions}</h2>
              </CardTitle>
              <CardDescription>
                {assessment.questionCount} {m.questions.toLowerCase()} ·{" "}
                {m.maxAttempts}: {assessment.maxAttempts}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="whitespace-pre-wrap">{assessment.instructions}</p>
              <StartAttemptButton
                classroomId={id}
                assessmentId={assessmentId}
                disabled={
                  classroom.status === "archived" ||
                  (assessment.attempts.length >= assessment.maxAttempts &&
                    !assessment.attempts.some(
                      (attempt) => !attempt.submittedAt,
                    ))
                }
              />
            </CardContent>
          </Card>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{m.attempts}</h2>
            {assessment.attempts.map((attempt) => (
              <Link
                className="flex flex-wrap justify-between gap-3 rounded-lg border p-4 text-sm underline underline-offset-4"
                key={attempt.id}
                href={`/dashboard/classrooms/${id}/attempts/${attempt.id}`}
              >
                <span>
                  {m.attempt} {attempt.number}
                </span>
                <span>
                  {attempt.submittedAt
                    ? `${attempt.score.toFixed(2)} / ${attempt.maximumScore} · ${attempt.pendingReview ? m.pending : m.complete}`
                    : m.active}
                </span>
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
