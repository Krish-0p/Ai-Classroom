import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { listLessons, lessonConcepts } from "@/server/lessons";
import { AppError } from "@/server/errors";
import { CreateLessonForm } from "@/features/lessons/create-form";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { lessonMessages as m } from "@/lib/lesson-messages";
import { curriculumMessages as cm } from "@/lib/curriculum-messages";
import { ResourceBrowser } from "@/components/workspace/resource-browser";

export default async function LessonsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageActor();
  const { id } = await params;
  let classroom: Awaited<ReturnType<typeof readClassroom>>;
  let lessons: Awaited<ReturnType<typeof listLessons>>;
  let concepts: Awaited<ReturnType<typeof lessonConcepts>> = [];
  try {
    classroom = await readClassroom(actor, id);
    lessons = await listLessons(actor, id);
    if (actor.role === "teacher") concepts = await lessonConcepts(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const published = lessons.filter(
    (lesson) => lesson.status === "published",
  ).length;
  return (
    <div
      className={`learning-page learning-page-lessons learning-page-${actor.role}`}
    >
      <header className="learning-page-hero">
        <div>
          <p className="learning-page-eyebrow">
            LESSON STUDIO <span>·</span> {classroom.name}
          </p>
          <h1>{m.title}</h1>
          <p>{actor.role === "teacher" ? m.teacherHelp : m.studentHelp}</p>
        </div>
        <div className="learning-page-stat">
          <strong>{lessons.length}</strong>
          <span>
            {actor.role === "teacher"
              ? "lessons in course"
              : "available lessons"}
          </span>
          <strong>{published}</strong>
          <span>published for class</span>
        </div>
      </header>
      <div
        className={
          actor.role === "teacher" ? "resource-library-layout" : undefined
        }
      >
        {actor.role === "teacher" && (
          <Card className="learning-panel learning-create-panel">
            <CardHeader className="learning-panel-header">
              <div>
                <p className="learning-section-kicker">BUILD THE COURSE</p>
                <CardTitle>
                  <h2>{m.new}</h2>
                </CardTitle>
              </div>
              <CardDescription>
                {concepts.length
                  ? "Start with a concept from the approved curriculum."
                  : m.noConceptsHelp}
              </CardDescription>
            </CardHeader>
            <CardContent className="learning-panel-content">
              {classroom.status === "archived" && (
                <p role="status" className="learning-status">
                  {cm.archived}
                </p>
              )}
              {!concepts.length && (
                <Link
                  className="learning-inline-link"
                  href={`/dashboard/classrooms/${id}/curriculum`}
                >
                  {m.noConcepts} <span aria-hidden="true">→</span>
                </Link>
              )}
              <CreateLessonForm
                classroomId={id}
                concepts={concepts}
                disabled={classroom.status === "archived"}
              />
            </CardContent>
          </Card>
        )}
        <section className="learning-list-section">
          <div className="learning-list-heading">
            <div>
              <p className="learning-section-kicker">
                {actor.role === "teacher"
                  ? "COURSE MATERIAL"
                  : "READY WHEN YOU ARE"}
              </p>
              <h2>
                {actor.role === "teacher"
                  ? "Course lessons"
                  : "Choose a lesson"}
              </h2>
            </div>
            <span>{lessons.length}</span>
          </div>
          {!lessons.length ? (
            <Empty className="learning-empty">
              <EmptyHeader>
                <EmptyTitle>{m.empty}</EmptyTitle>
                <EmptyDescription>
                  {actor.role === "teacher" ? m.teacherEmpty : m.studentEmpty}
                </EmptyDescription>
              </EmptyHeader>
              {actor.role === "student" && (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/dashboard/classrooms/${id}/curriculum`}
                >
                  Explore curriculum
                </Link>
              )}
            </Empty>
          ) : (
            <ResourceBrowser
              teacher={actor.role === "teacher"}
              items={lessons.map((lesson, index) => ({
                id: lesson.id,
                title: lesson.title,
                search: lesson.conceptTitle,
                status: lesson.status,
                content: (
                  <li key={lesson.id} className="learning-resource-card">
                    <span className="learning-resource-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="learning-resource-main">
                      <div className="learning-resource-labels">
                        <Badge variant="secondary">
                          {lesson.status === "review"
                            ? m.reviewStatus
                            : m[lesson.status]}
                        </Badge>
                        <span>
                          {lesson.estimatedMinutes} {m.minuteLabel}
                        </span>
                      </div>
                      <h3>{lesson.title}</h3>
                      <p>{lesson.conceptTitle}</p>
                      {actor.role === "teacher" &&
                        lesson.status === "published" &&
                        lesson.version > lesson.publishedVersion && (
                          <p className="learning-status">
                            {m.unpublishedChanges}
                          </p>
                        )}
                    </div>
                    <Link
                      href={`/dashboard/classrooms/${id}/lessons/${lesson.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        className: "learning-resource-action",
                      })}
                    >
                      {actor.role === "teacher" ? m.edit : m.open}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ),
              }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
