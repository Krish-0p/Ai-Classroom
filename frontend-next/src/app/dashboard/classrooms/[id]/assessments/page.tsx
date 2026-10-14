import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { listAssessments } from "@/server/assessments";
import { AppError } from "@/server/errors";
import { CreateAssessmentForm } from "@/features/assessments/actions";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { assessmentMessages as m } from "@/lib/assessment-messages";

export default async function AssessmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  let classroom: Awaited<ReturnType<typeof readClassroom>>;
  let assessments: Awaited<ReturnType<typeof listAssessments>>;
  try {
    classroom = await readClassroom(actor, id);
    assessments = await listAssessments(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const published = assessments.filter((assessment) => assessment.status === "published").length;
  return (
    <div className={`learning-page learning-page-assessments learning-page-${actor.role}`}>
      <header className="learning-page-hero">
        <div><p className="learning-page-eyebrow">PRACTICE & FEEDBACK <span>·</span> {classroom.name}</p><h1>{m.title}</h1><p>{actor.role === "teacher" ? m.teacherHelp : m.studentHelp}</p></div>
        <div className="learning-page-stat"><strong>{assessments.length}</strong><span>{actor.role === "teacher" ? "assessments created" : "ways to practice"}</span><strong>{published}</strong><span>available to students</span></div>
      </header>
      {actor.role === "teacher" && (
        <Card className="learning-panel learning-create-panel">
          <CardHeader className="learning-panel-header"><div><p className="learning-section-kicker">CHECK FOR UNDERSTANDING</p><CardTitle><h2>{m.new}</h2></CardTitle></div><CardDescription>{m.teacherHelp}</CardDescription></CardHeader>
          <CardContent className="learning-panel-content">{classroom.status === "archived" && <p role="status" className="learning-status">{m.readonly}</p>}<CreateAssessmentForm classroomId={id} disabled={classroom.status === "archived"} /></CardContent>
        </Card>
      )}
      <section className="learning-list-section">
        <div className="learning-list-heading"><div><p className="learning-section-kicker">{actor.role === "teacher" ? "ASSESSMENT LIBRARY" : "YOUR PRACTICE"}</p><h2>{actor.role === "teacher" ? "Your assessments" : "Ready to practice"}</h2></div><span>{assessments.length}</span></div>
        {!assessments.length ? (
          <Empty className="learning-empty"><EmptyHeader><EmptyTitle>{m.empty}</EmptyTitle><EmptyDescription>{actor.role === "teacher" ? m.noConcepts : m.emptyHelp}</EmptyDescription></EmptyHeader>{actor.role === "student" && <Link className={buttonVariants({ variant: "outline" })} href={`/dashboard/classrooms/${id}/curriculum`}>Review course map</Link>}</Empty>
        ) : (
          <ol className="learning-resource-list">
            {assessments.map((item, index) => (
              <li key={item.id} className="learning-resource-card learning-assessment-card">
                <span className="learning-resource-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="learning-resource-main"><div className="learning-resource-labels"><Badge variant="secondary">{item.status === "published" ? m.published : item.status === "archived" ? m.archived : m.draft}</Badge></div><h3>{item.title}</h3><p>{actor.role === "teacher" ? "Review questions, feedback and student attempts." : "Work through questions at your own pace and review your feedback."}</p>{actor.role === "teacher" && item.status === "published" && item.version > item.publishedVersion && <p className="learning-status">{m.changed}</p>}</div>
                <Link href={`/dashboard/classrooms/${id}/assessments/${item.id}`} className={buttonVariants({ variant: "outline", className: "learning-resource-action" })}>{actor.role === "teacher" ? m.edit : m.open}<span aria-hidden="true">→</span></Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
