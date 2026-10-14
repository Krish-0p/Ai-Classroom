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
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          <h1>{m.editClassroom}</h1>
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
  );
}
