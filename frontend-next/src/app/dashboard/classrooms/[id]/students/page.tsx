import { notFound, redirect } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readClassroom } from "@/server/classrooms";
import { AppError } from "@/server/errors";
import { StudentRoster } from "@/features/classrooms/student-roster";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { messages as m } from "@/lib/messages";
import { workspaceMessages as w } from "@/lib/workspace-messages";

export default async function StudentsPage({
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
  const students = (classroom.enrollments ?? []).map((enrollment) => ({
    id: enrollment.student.id,
    name: enrollment.student.name,
    joinedAt: enrollment.joinedAt.toLocaleDateString("en-IN", {
      timeZone: "UTC",
    }),
  }));
  return (
    <div className="learning-page">
      <header className="learning-page-hero">
        <div>
          <p className="learning-page-eyebrow">{classroom.name}</p>
          <h1>{m.studentsNav}</h1>
          <p>{w.rosterHelp}</p>
        </div>
        <div className="learning-page-stat">
          <strong>{students.length}</strong>
          <span>{m.enrolledStudents}</span>
        </div>
      </header>
      <div className="settings-layout">
        <StudentRoster students={students} />
        <aside>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{m.joinCode}</h2>
              </CardTitle>
              <CardDescription>{m.codeDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <code className="text-2xl tracking-widest">
                {classroom.joinCode}
              </code>
              <p className="text-sm text-muted-foreground">
                {classroom.status === "archived" ? m.archivedHelp : m.joinHelp}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
