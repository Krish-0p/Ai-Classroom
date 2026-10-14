import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { readCurriculum } from "@/server/curriculum";
import { AppError } from "@/server/errors";
import { SourcePanel } from "@/features/curriculum/source-panel";
import { CurriculumEditor } from "@/features/curriculum/editor";
import { KnowledgeGraph } from "@/features/knowledge-graph/graph";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { curriculumMessages as m } from "@/lib/curriculum-messages";

export default async function CurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  let classroom: Awaited<ReturnType<typeof readClassroom>>;
  let curriculum: Awaited<ReturnType<typeof readCurriculum>>;
  try {
    classroom = await readClassroom(actor, id);
    curriculum = await readCurriculum(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const disabled = classroom.status === "archived";
  const conceptCount = curriculum.approved?.units.reduce((count, unit) => count + unit.concepts.length, 0) ?? 0;
  return (
    <div className="learning-page learning-page-curriculum">
      <header className="learning-page-hero">
        <div><p className="learning-page-eyebrow">COURSE MAP <span>·</span> {classroom.name}</p><h1>{m.title}</h1><p>{actor.role === "teacher" ? m.teacherHelp : m.studentHelp}</p></div>
        <div className="learning-page-stat"><strong>{curriculum.approved?.units.length ?? 0}</strong><span>approved units</span><strong>{conceptCount}</strong><span>course concepts</span></div>
      </header>
      {actor.role === "teacher" && "draft" in curriculum && (
        <div className="curriculum-teacher-workflow">
          {disabled && <p role="status" className="learning-status">{m.archived}</p>}
          <SourcePanel classroomId={id} sources={curriculum.sources ?? []} initialJob={curriculum.job ?? null} disabled={disabled} />
          <CurriculumEditor
            key={curriculum.draftVersion}
            classroomId={id}
            initial={curriculum.draft ?? null}
            version={curriculum.draftVersion ?? 0}
            courseName={classroom.name}
            disabled={disabled || curriculum.job?.status === "queued" || curriculum.job?.status === "generating"}
            availableSources={curriculum.sources ?? []}
            initialSourceIds={curriculum.sourceIds ?? []}
          />
        </div>
      )}
      {curriculum.approved ? (
        <Card className="learning-panel approved-curriculum-panel">
          <CardHeader className="learning-panel-header">
            <div><p className="learning-section-kicker">{m.approved}</p><CardTitle><h2>{curriculum.approved.courseTitle}</h2></CardTitle></div>
            <CardDescription>Version {curriculum.approvedVersion}</CardDescription>
          </CardHeader>
          <CardContent className="approved-curriculum-content">
            {!!curriculum.approved.learningOutcomes.length && (
              <section className="curriculum-outcomes"><h3>{m.outcomes.split(" (")[0]}</h3><ul>{curriculum.approved.learningOutcomes.map((outcome, index) => <li key={index}>{outcome}</li>)}</ul></section>
            )}
            <ol className="curriculum-units">
              {curriculum.approved.units.map((unit, index) => (
                <li className="curriculum-unit" key={unit.id}>
                  <span className="curriculum-unit-number">{String(index + 1).padStart(2, "0")}</span>
                  <div><h3>{unit.title}</h3><p>{unit.description}</p>
                    {unit.concepts.length > 0 && <ul className="curriculum-concepts">{unit.concepts.map((concept) => <li key={concept.id}>{concept.title}</li>)}</ul>}
                  </div>
                </li>
              ))}
            </ol>
            <KnowledgeGraph curriculum={curriculum.approved} />
          </CardContent>
        </Card>
      ) : (
        <Empty className="learning-empty"><EmptyHeader><EmptyTitle>{m.empty}</EmptyTitle><EmptyDescription>{m.emptyHelp}</EmptyDescription></EmptyHeader></Empty>
      )}
    </div>
  );
}
