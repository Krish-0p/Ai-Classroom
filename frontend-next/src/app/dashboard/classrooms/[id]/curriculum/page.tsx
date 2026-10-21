import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { readCurriculum } from "@/server/curriculum";
import { AppError } from "@/server/errors";
import { SourcePanel } from "@/features/curriculum/source-panel";
import { CurriculumEditor } from "@/features/curriculum/editor";
import { KnowledgeGraph } from "@/features/knowledge-graph/graph";
import {
  SectionTabs,
  type WorkspaceSection,
} from "@/components/workspace/section-tabs";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
import { workspaceMessages as w } from "@/lib/workspace-messages";

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  const approved = curriculum.approved;
  const conceptCount =
    approved?.units.reduce((count, unit) => count + unit.concepts.length, 0) ??
    0;
  const sections: WorkspaceSection[] = [];
  if (actor.role === "teacher" && "draft" in curriculum) {
    sections.push(
      {
        id: "sources",
        label: w.sources,
        content: (
          <SourcePanel
            classroomId={id}
            sources={curriculum.sources ?? []}
            initialJob={curriculum.job ?? null}
            disabled={disabled}
          />
        ),
      },
      {
        id: "draft",
        label: w.draft,
        content: (
          <CurriculumEditor
            key={curriculum.draftVersion}
            classroomId={id}
            initial={curriculum.draft ?? null}
            version={curriculum.draftVersion ?? 0}
            courseName={classroom.name}
            disabled={
              disabled ||
              curriculum.job?.status === "queued" ||
              curriculum.job?.status === "generating"
            }
            availableSources={curriculum.sources ?? []}
            initialSourceIds={curriculum.sourceIds ?? []}
          />
        ),
      },
    );
  }
  sections.push({
    id: "published",
    label: w.published,
    content: approved ? (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              <h2>{approved.courseTitle}</h2>
            </CardTitle>
            <Badge variant="secondary">
              {m.approved} · v{curriculum.approvedVersion}
            </Badge>
          </div>
          <CardDescription>{w.unitHelp}</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionTabs
            outline
            label={w.courseOutline}
            sections={[
              {
                id: "outcomes",
                label: m.outcomes.split(" (")[0],
                content: (
                  <section className="curriculum-outcomes">
                    <h3>{m.outcomes.split(" (")[0]}</h3>
                    <ul>
                      {approved.learningOutcomes.map((outcome, index) => (
                        <li key={index}>{outcome}</li>
                      ))}
                    </ul>
                  </section>
                ),
              },
              ...approved.units.map((unit, index) => ({
                id: unit.id,
                label: unit.title,
                content: (
                  <section className="unit-detail">
                    <p className="learning-section-kicker">
                      {m.unit} {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2>{unit.title}</h2>
                    <p>{unit.description}</p>
                    <Badge variant="outline">
                      {unit.concepts.length} {w.conceptCount}
                    </Badge>
                    <ol className="concept-detail-grid">
                      {unit.concepts.map((concept, i) => (
                        <li key={concept.id}>
                          <span className="outline-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <h3>{concept.title}</h3>
                            <p>{concept.description}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ),
              })),
            ]}
          />
        </CardContent>
      </Card>
    ) : (
      <Empty className="learning-empty">
        <EmptyHeader>
          <EmptyTitle>{m.empty}</EmptyTitle>
          <EmptyDescription>{m.emptyHelp}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ),
  });
  if (approved)
    sections.push({
      id: "map",
      label: w.knowledgeMap,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{w.knowledgeMap}</h2>
            </CardTitle>
            <CardDescription>{w.unitHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            <KnowledgeGraph curriculum={approved} />
          </CardContent>
        </Card>
      ),
    });
  return (
    <div className="learning-page learning-page-curriculum">
      <header className="learning-page-hero">
        <div>
          <p className="learning-page-eyebrow">{classroom.name}</p>
          <h1>{m.title}</h1>
          <p>{actor.role === "teacher" ? m.teacherHelp : m.studentHelp}</p>
        </div>
        <div className="learning-page-stat">
          <strong>{approved?.units.length ?? 0}</strong>
          <span>{m.unit}</span>
          <strong>{conceptCount}</strong>
          <span>{w.conceptCount}</span>
        </div>
      </header>
      {disabled && actor.role === "teacher" && (
        <p role="status" className="learning-status">
          {m.archived}
        </p>
      )}
      <SectionTabs
        label={m.title}
        defaultValue={
          actor.role === "teacher"
            ? "draft" in curriculum && curriculum.draft
              ? "draft"
              : "sources"
            : "published"
        }
        sections={sections}
      />
    </div>
  );
}
