import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  ClipboardCheck,
  Plus,
  UsersRound,
} from "lucide-react";
import { requirePageActor } from "@/server/session";
import { listClassrooms } from "@/server/classrooms";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { JoinForm } from "@/features/classrooms/join-form";
import { messages as m } from "@/lib/messages";

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const classrooms = await listClassrooms(actor);
  const teacher = actor.role === "teacher";
  const studentCount = teacher
    ? classrooms.reduce((total, classroom) => total + classroom._count.enrollments, 0)
    : 0;

  return (
    <div className={`workspace-page ${teacher ? "workspace-page-teacher" : "workspace-page-student"}`}>
      <section className="workspace-welcome">
        <div className="workspace-welcome-copy">
          <Badge className="workspace-eyebrow" variant="outline">
            {teacher ? "TEACHER WORKSPACE" : "STUDENT WORKSPACE"}
          </Badge>
          <p className="workspace-greeting">{teacher ? "Plan your next class" : "Pick up where you left off"}</p>
          <h1>{teacher ? "Your classroom, at a glance." : "Your learning, in one place."}</h1>
          <p>
            {teacher
              ? "Your courses, students, and teaching tools are ready when you are."
              : "Jump back into a course, find your next lesson, or check your progress."}
          </p>
        </div>
        <div className="workspace-welcome-art" aria-hidden="true">
          {teacher ? <><span className="workspace-art-tile workspace-art-yellow"><UsersRound /></span><span className="workspace-art-tile workspace-art-blue"><BookOpenCheck /></span></> : <><span className="workspace-art-tile workspace-art-mint"><BookOpenCheck /></span><span className="workspace-art-tile workspace-art-coral"><ClipboardCheck /></span></>}
        </div>
        {teacher && (
          <Link className={buttonVariants({ className: "workspace-create" })} href="/dashboard/classrooms/new">
            <Plus data-icon="inline-start" /> {m.newClassroom}
          </Link>
        )}
      </section>

      {teacher ? (
        <section className="workspace-metrics" aria-label="Teaching overview">
          <article className="workspace-metric"><span className="workspace-metric-icon workspace-metric-amber"><BookOpen aria-hidden="true" /></span><div><span>Classrooms</span><strong>{classrooms.length}</strong></div></article>
          <article className="workspace-metric"><span className="workspace-metric-icon workspace-metric-blue"><UsersRound aria-hidden="true" /></span><div><span>Enrolled students</span><strong>{studentCount}</strong></div></article>
          <article className="workspace-metric workspace-metric-note"><span>Your next step</span><strong>{classrooms.length ? "Open a classroom to continue planning." : "Create your first classroom."}</strong></article>
        </section>
      ) : (
        <Card className="student-join-panel">
          <div className="student-join-copy"><span className="workspace-metric-icon workspace-metric-mint"><Plus aria-hidden="true" /></span><div><h2>Joining a new class?</h2><p>Enter the code your teacher shared. Your course will appear here.</p></div></div>
          <JoinForm />
        </Card>
      )}

      <section className="workspace-classrooms" aria-label={teacher ? "Your teaching classrooms" : "Your learning courses"}>
        <div className="workspace-section-heading">
          <div><p className="workspace-section-kicker">{teacher ? "READY TO TEACH" : "YOUR LEARNING SPACE"}</p><h2>{teacher ? "Your classrooms" : "Your courses"}</h2></div>
          <p>{classrooms.length} {classrooms.length === 1 ? "course" : "courses"}</p>
        </div>
        {classrooms.length === 0 ? (
          <Empty className="workspace-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
              <EmptyTitle>{teacher ? "Start with your first classroom" : "Your courses will show up here"}</EmptyTitle>
              <EmptyDescription>
                {teacher
                  ? "Create a classroom, add your curriculum, then share its join code with students."
                  : "Join a class with the code from your teacher. Your lessons and progress will live here."}
              </EmptyDescription>
            </EmptyHeader>
            {teacher && <Link className={buttonVariants()} href="/dashboard/classrooms/new"><Plus data-icon="inline-start" /> Create classroom</Link>}
          </Empty>
        ) : (
          <div className="workspace-course-grid">
            {classrooms.map((classroom) => (
              <Card key={classroom.id} className={`classroom-card ${teacher ? "classroom-card-teacher" : "classroom-card-student"}`}>
                <CardHeader className="workspace-course-header">
                  <div className="workspace-course-topline"><span className="workspace-course-icon">{teacher ? <BookOpenCheck aria-hidden="true" /> : <BookOpen aria-hidden="true" />}</span><Badge variant="secondary">{m[classroom.status]}</Badge></div>
                  <CardTitle><h3>{classroom.name}</h3></CardTitle>
                  <p className="workspace-course-meta">{classroom.academicLevel} <span aria-hidden="true">·</span> {classroom.durationWeeks} {m.weeks}</p>
                </CardHeader>
                <CardContent className="workspace-course-content">
                  <p className="workspace-course-description">{classroom.description}</p>
                  {teacher ? (
                    <div className="workspace-class-code"><span><UsersRound aria-hidden="true" /> {classroom._count.enrollments} {classroom._count.enrollments === 1 ? "student" : "students"}</span>{classroom.joinCode && <span className="workspace-code-value">Join code <code>{classroom.joinCode}</code></span>}</div>
                  ) : (
                    <p className="workspace-teacher-name">Your teacher <strong>{classroom.teacher.name}</strong></p>
                  )}
                  <Link className={buttonVariants({ className: "workspace-course-action" })} href={`/dashboard/classrooms/${classroom.id}`}>
                    {teacher ? "Open teaching space" : "Continue learning"}<ArrowRight data-icon="inline-end" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
