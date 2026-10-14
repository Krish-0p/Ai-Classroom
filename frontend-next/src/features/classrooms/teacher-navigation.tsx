"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { messages as m } from "@/lib/messages";
import { curriculumMessages } from "@/lib/curriculum-messages";
import { lessonMessages } from "@/lib/lesson-messages";
import { assessmentMessages } from "@/lib/assessment-messages";
import { tutorMessages } from "@/lib/tutor-messages";
import { analyticsMessages } from "@/lib/analytics-messages";
const destinations = [
  ["curriculum", curriculumMessages.title],
  ["lessons", lessonMessages.title],
  ["assessments", assessmentMessages.title],
  ["analytics", analyticsMessages.title],
  ["tutor", tutorMessages.title],
] as const;
export function TeacherNavigation({ classrooms }: { classrooms: { id: string; name: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const classroom = classrooms.find(item => pathname === `/dashboard/classrooms/${item.id}` || pathname.startsWith(`/dashboard/classrooms/${item.id}/`)) ?? classrooms[0];
  return <section className="workspace-context-nav" aria-label={m.teacherTools}>
    <div className="workspace-context-select">{classroom ? <Field><FieldLabel htmlFor="teacher-classroom">{m.teachingClassroom}</FieldLabel><NativeSelect id="teacher-classroom" value={classroom.id} onChange={event => router.push(`/dashboard/classrooms/${event.target.value}`)}>{classrooms.map(item => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field> : <div className="workspace-context-empty"><span>{m.teachingClassroom}</span><p>{m.createForTools}</p></div>}</div>
    <nav className="workspace-context-links" aria-label={m.teacherTools}>
      {destinations.map(([path, label]) => { const href = classroom ? `/dashboard/classrooms/${classroom.id}/${path}` : null; const active = !!href && (pathname === href || pathname.startsWith(`${href}/`)); return href ? <Link key={path} href={href} aria-current={active ? "page" : undefined} className={buttonVariants({ variant: active ? "default" : "outline", size: "sm" })}>{label}</Link> : <Button key={path} variant="outline" size="sm" disabled>{label}</Button>; })}
      {classroom && <Link href={`/dashboard/classrooms/${classroom.id}/edit`} className={buttonVariants({ variant: pathname.endsWith("/edit") ? "default" : "outline", size: "sm" })}>{m.editClassroom}</Link>}
      {classroom && <Link href={`/dashboard/classrooms/${classroom.id}#students`} className={buttonVariants({ variant: "outline", size: "sm" })}>{m.studentsNav}</Link>}
    </nav>
  </section>;
}
