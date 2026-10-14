import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { AppError } from "@/server/errors";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { DeleteButton } from "@/features/classrooms/delete-button";
import { messages as m } from "@/lib/messages";
export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageActor();
  const { id } = await params;
  let classroom: Awaited<ReturnType<typeof readClassroom>>;
  try {
    classroom = await readClassroom(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div className="classroom-details">
      <Link href="/dashboard" className="text-sm underline underline-offset-4">
        {m.back}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Badge variant="secondary">{m[classroom.status]}</Badge>
          <h1 className="break-words text-3xl font-semibold tracking-tight">
            {classroom.name}
          </h1>
          <p className="text-muted-foreground">
            {classroom.academicLevel} · {classroom.language} ·{" "}
            {classroom.durationWeeks} {m.weeks}
          </p>
        </div>
        {actor.role === "teacher" && (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/dashboard/classrooms/${id}/edit`}
          >
            {m.editClassroom}
          </Link>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{m.courseDetails}</h2>
          </CardTitle>
          <CardDescription>
            {m.teacherName}: {classroom.teacher.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap break-words">
            {classroom.description}
          </p>
        </CardContent>
        <CardFooter>{m[classroom.status]}</CardFooter>
      </Card>
      {actor.role === "teacher" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{m.joinCode}</h2>
              </CardTitle>
              <CardDescription>{m.codeDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-2xl font-semibold tracking-widest">
                {classroom.joinCode}
              </code>
            </CardContent>
            <CardFooter>
              {classroom.status === "archived" ? m.archivedHelp : m.joinHelp}
            </CardFooter>
          </Card>
          <section id="students" className="classroom-roster" aria-label={m.enrolledStudents}>
            <h2 className="mb-4 text-xl font-semibold">{m.enrolledStudents}</h2>
            {!classroom.enrollments?.length ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>{m.noStudents}</EmptyTitle>
                  <EmptyDescription>{m.noStudentsHelp}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {classroom.enrollments.map((enrollment) => (
                  <li
                    key={enrollment.student.id}
                    className="flex flex-wrap justify-between gap-2 rounded-lg border p-4"
                  >
                    <span>{enrollment.student.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {m.joined}{" "}
                      {enrollment.joinedAt.toLocaleDateString("en-IN", {
                        timeZone: "UTC",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <DeleteButton id={id} />
        </>
      )}
    </div>
  );
}
