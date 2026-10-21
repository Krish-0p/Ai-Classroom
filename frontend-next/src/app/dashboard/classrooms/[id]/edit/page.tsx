import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { AppError } from "@/server/errors";
import { ClassroomForm } from "@/features/classrooms/classroom-form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { messages as m } from "@/lib/messages";
import { workspaceMessages as w } from "@/lib/workspace-messages";
import { Badge } from "@/components/ui/badge";
export default async function EditClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageActor();
  if (actor.role !== "teacher") redirect("/dashboard");
  const { id } = await params;
  let classroom: Awaited<ReturnType<typeof readClassroom>>;
  try {
    classroom = await readClassroom(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const initial = {
    name: classroom.name,
    description: classroom.description,
    academicLevel: classroom.academicLevel,
    language: classroom.language,
    durationWeeks: classroom.durationWeeks,
    status: classroom.status,
  };
  return (
    <div className="learning-page">
      <header className="learning-page-hero">
        <div>
          <p className="learning-page-eyebrow">{classroom.name}</p>
          <h1>{m.editClassroom}</h1>
          <p>{w.settingsHelp}</p>
        </div>
        <Badge variant="secondary">{m[classroom.status]}</Badge>
      </header>
      <div className="settings-layout">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{w.courseDetails}</h2>
            </CardTitle>
            <CardDescription>{classroom.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <ClassroomForm id={id} initial={initial} />
          </CardContent>
          <CardFooter>
            <Link href={`/dashboard/classrooms/${id}`}>{m.cancel}</Link>
          </CardFooter>
        </Card>
        <aside>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{w.settingsGuide}</h2>
              </CardTitle>
              <CardDescription>{w.settingsNote}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {m.teacherName}: {classroom.teacher.name}
              </p>
              <p className="text-sm text-muted-foreground">{m.joinCode}</p>
              <code className="text-xl tracking-widest">
                {classroom.joinCode}
              </code>
            </CardContent>
            <CardFooter>
              <Link
                className="text-sm underline underline-offset-4"
                href={`/dashboard/classrooms/${id}/students`}
              >
                {m.studentsNav}
              </Link>
            </CardFooter>
          </Card>
        </aside>
      </div>
    </div>
  );
}
