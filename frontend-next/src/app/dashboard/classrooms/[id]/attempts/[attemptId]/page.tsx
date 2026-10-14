import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { readAttempt } from "@/server/attempts";
import { AppError } from "@/server/errors";
import { AttemptPlayer } from "@/features/assessments/attempt-player";
import { assessmentMessages as m } from "@/lib/assessment-messages";
export default async function AttemptPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const actor = await requirePageActor();
  const { id, attemptId } = await params;
  let classroom: Awaited<ReturnType<typeof readClassroom>>;
  let attempt: Awaited<ReturnType<typeof readAttempt>>;
  try {
    classroom = await readClassroom(actor, id);
    attempt = await readAttempt(actor, id, attemptId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4">
        <Link
          className="text-sm underline underline-offset-4"
          href={`/dashboard/classrooms/${id}/assessments`}
        >
          {m.back}
        </Link>
        {actor.role === "student" && (
          <Link
            className="text-sm underline underline-offset-4"
            href={`/dashboard/classrooms/${id}/progress`}
          >
            {m.progress}
          </Link>
        )}
      </div>
      <h1 className="break-words text-3xl font-semibold tracking-tight">
        {attempt.title}
      </h1>
      {classroom.status === "archived" && <p role="status">{m.readonly}</p>}
      <AttemptPlayer
        key={attempt.submittedAt?.toISOString() ?? "active"}
        attempt={attempt}
        classroomId={id}
        teacher={actor.role === "teacher"}
        disabled={classroom.status === "archived"}
      />
    </div>
  );
}
