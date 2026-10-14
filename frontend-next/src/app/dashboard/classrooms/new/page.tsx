import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageActor } from "@/server/session";
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
export default async function NewClassroomPage() {
  const actor = await requirePageActor();
  if (actor.role !== "teacher") redirect("/dashboard");
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          <h1>{m.newClassroom}</h1>
        </CardTitle>
        <CardDescription>{m.teacherDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <ClassroomForm />
      </CardContent>
      <CardFooter>
        <Link href="/dashboard">{m.back}</Link>
      </CardFooter>
    </Card>
  );
}
