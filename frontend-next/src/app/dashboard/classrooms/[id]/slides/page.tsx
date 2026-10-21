import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { readSlides } from "@/server/slides";
import { AppError } from "@/server/errors";
import { SlidesWorkspace } from "@/features/slides/workspace";
import { SlidePlayer } from "@/features/slides/player";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { slideMessages as m } from "@/lib/slide-messages";

export default async function SlidesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageActor();
  const { id } = await params;
  try {
    const [classroom, data] = await Promise.all([
      readClassroom(actor, id),
      readSlides(actor, id),
    ]);
    return (
      <div className="learning-page learning-page-slides">
        <header className="learning-page-hero">
          <div>
            <p className="learning-page-eyebrow">
              {m.eyebrow} <span>·</span> {classroom.name}
            </p>
            <h1>{m.title}</h1>
            <p>{actor.role === "teacher" ? m.teacherHelp : m.studentHelp}</p>
          </div>
        </header>
        {data.role === "teacher" ? (
          data.draft ? (
            <SlidesWorkspace
              key={`${data.version}:${data.job?.id}:${data.job?.status}`}
              classroomId={id}
              initial={data}
              document={data.draft}
              disabled={classroom.status === "archived"}
            />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{m.missing}</EmptyTitle>
                <EmptyDescription>{m.missingHelp}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link
                  href={`/dashboard/classrooms/${id}/curriculum`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {m.curriculum}
                </Link>
              </EmptyContent>
            </Empty>
          )
        ) : data.published ? (
          <section className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{m.published}</Badge>
              {data.aiGenerated && (
                <Badge variant="outline">{m.aiGenerated}</Badge>
              )}
            </div>
            <SlidePlayer deck={data.published} concepts={data.concepts} />
          </section>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{m.unpublished}</EmptyTitle>
              <EmptyDescription>{m.unpublishedHelp}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.status))
      notFound();
    throw error;
  }
}
