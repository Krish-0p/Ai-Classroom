import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { readTutor } from "@/server/tutor";
import { readIndexes } from "@/server/rag-index";
import { AppError } from "@/server/errors";
import { TutorWorkspace } from "@/features/tutor/workspace";
import { SourceIndexer } from "@/features/tutor/source-indexer";
import { tutorMessages as m } from "@/lib/tutor-messages";
export default async function TutorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageActor();
  const { id } = await params;
  try {
    const classroom = await readClassroom(actor, id);
    const tutor = await readTutor(actor, id);
    const indexes =
      actor.role === "teacher" ? await readIndexes(actor, id) : null;
    return (
      <div className={`learning-page learning-page-tutor learning-page-${actor.role}`}>
        <header className="learning-page-hero">
          <div><p className="learning-page-eyebrow">ASK, EXPLORE, UNDERSTAND <span>·</span> {classroom.name}</p><h1>{m.title}</h1><p>{actor.role === "teacher" ? "Ground answers in the approved course material and help students explore difficult ideas." : m.description}</p></div>
          {actor.role === "student" && <div className="tutor-trust-note"><span aria-hidden="true">✳</span><p>Check the cited source excerpts. Tutor answers are AI-generated and may need verification.</p></div>}
        </header>
        {classroom.status === "archived" && <p role="status" className="learning-status">{m.archived}</p>}
        <div className={`tutor-workspace-layout ${indexes ? "tutor-workspace-teacher" : "tutor-workspace-student"}`}>
          {indexes && <aside className="tutor-source-sidebar"><p className="learning-section-kicker">FOR TEACHERS</p><SourceIndexer classroomId={id} initial={indexes} disabled={classroom.status === "archived"} /></aside>}
          <TutorWorkspace classroomId={id} initial={tutor} disabled={classroom.status === "archived"} />
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.status))
      notFound();
    throw error;
  }
}
