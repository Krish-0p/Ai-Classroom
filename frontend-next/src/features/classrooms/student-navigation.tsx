"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { BookOpenText, BrainCircuit, ChartNoAxesColumnIncreasing, Compass, ClipboardList } from "lucide-react";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { messages as m } from "@/lib/messages";
import { curriculumMessages } from "@/lib/curriculum-messages";
import { lessonMessages } from "@/lib/lesson-messages";
import { assessmentMessages } from "@/lib/assessment-messages";
import { tutorMessages } from "@/lib/tutor-messages";
const destinations = [
  ["curriculum", curriculumMessages.title, Compass],
  ["lessons", lessonMessages.title, BookOpenText],
  ["assessments", assessmentMessages.title, ClipboardList],
  ["progress", assessmentMessages.progress, ChartNoAxesColumnIncreasing],
  ["tutor", tutorMessages.title, BrainCircuit],
] as const;
export function StudentNavigation({
  classrooms,
}: {
  classrooms: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const classroom =
    classrooms.find(
      (item) =>
        pathname === `/dashboard/classrooms/${item.id}` ||
        pathname.startsWith(`/dashboard/classrooms/${item.id}/`),
    ) ?? classrooms[0];
  return (
    <section className="workspace-context-nav" aria-label={m.studentTools}>
      <div className="workspace-context-select">
      {classroom ? (
        <Field className="max-w-sm">
          <FieldLabel htmlFor="student-classroom">
            {m.learningClassroom}
          </FieldLabel>
          <NativeSelect
            id="student-classroom"
            value={classroom.id}
            onChange={(event) =>
              router.push(`/dashboard/classrooms/${event.target.value}`)
            }
          >
            {classrooms.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <div className="workspace-context-empty"><span>{m.learningClassroom}</span><p>{m.joinForTools}</p></div>
      )}
      </div>
      <nav className="workspace-context-links" aria-label={m.studentTools}>
        {destinations.map(([path, label, Icon]) => {
          const href = classroom
            ? `/dashboard/classrooms/${classroom.id}/${path}`
            : null;
          const active =
            !!href && (pathname === href || pathname.startsWith(`${href}/`));
          return href ? (
            <Link
              key={path}
              href={href}
              aria-current={active ? "page" : undefined}
              className={buttonVariants({
                variant: active ? "default" : "outline",
                size: "sm",
              })}
            >
              <Icon data-icon="inline-start" />
              {label}
            </Link>
          ) : (
            <Button key={path} variant="outline" size="sm" disabled>
              <Icon data-icon="inline-start" />
              {label}
            </Button>
          );
        })}
      </nav>
    </section>
  );
}
