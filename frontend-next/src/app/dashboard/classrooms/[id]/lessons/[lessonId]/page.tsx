import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { readLesson } from "@/server/lessons";
import { AppError } from "@/server/errors";
import { LessonEditor } from "@/features/lessons/editor";
import { LessonPlayer } from "@/features/lessons/player";
import { lessonMessages as m } from "@/lib/lesson-messages";
import { curriculumMessages as cm } from "@/lib/curriculum-messages";
import { WorkspacePageHeader } from "@/components/workspace/page-header";
export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const actor = await requirePageActor();
  const { id, lessonId } = await params;
  let classroom: Awaited<ReturnType<typeof readClassroom>>;
  let lesson: Awaited<ReturnType<typeof readLesson>>;
  try {
    classroom = await readClassroom(actor, id);
    lesson = await readLesson(actor, id, lessonId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div className="learning-page">
      <Link
        href={`/dashboard/classrooms/${id}/lessons`}
        className="text-sm underline underline-offset-4"
      >
        {m.back}
      </Link>
      <WorkspacePageHeader
        title={lesson.document.title}
        eyebrow={classroom.name}
        description={`${lesson.conceptTitle} · ${lesson.document.estimatedMinutes} ${m.minuteLabel}`}
      />
      {lesson.kind === "teacher" ? (
        <>
          {classroom.status === "archived" && (
            <p role="status">{cm.archived}</p>
          )}
          <LessonEditor
            key={`${lesson.id}-${lesson.job?.status === "complete" ? lesson.job.id : "manual"}`}
            classroomId={id}
            lessonId={lessonId}
            initial={lesson.document}
            initialVersion={lesson.version}
            initialStatus={lesson.status}
            publishedVersion={lesson.publishedVersion}
            initialJob={lesson.job}
            disabled={classroom.status === "archived"}
          />
        </>
      ) : (
        <LessonPlayer
          key={lesson.version}
          lesson={lesson.document}
          activity={
            classroom.status === "active"
              ? { classroomId: id, lessonId, version: lesson.version }
              : undefined
          }
        />
      )}
    </div>
  );
}
