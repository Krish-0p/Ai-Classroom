"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenText,
  Presentation,
  ChartNoAxesColumnIncreasing,
  Compass,
  ClipboardList,
  LayoutDashboard,
  Settings2,
  Users,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { messages as m } from "@/lib/messages";
import { curriculumMessages } from "@/lib/curriculum-messages";
import { lessonMessages } from "@/lib/lesson-messages";
import { assessmentMessages } from "@/lib/assessment-messages";
import { slideMessages } from "@/lib/slide-messages";
import { analyticsMessages } from "@/lib/analytics-messages";
import { workspaceMessages as w } from "@/lib/workspace-messages";
import { teacherAiMessages } from "@/lib/teacher-ai-messages";

export function CourseNavigation({
  classrooms,
  role,
  name,
}: {
  classrooms: { id: string; name: string }[];
  role: "teacher" | "student";
  name: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const classroom =
    classrooms.find(
      (item) =>
        pathname === `/dashboard/classrooms/${item.id}` ||
        pathname.startsWith(`/dashboard/classrooms/${item.id}/`),
    ) ?? classrooms[0];
  const teacher = role === "teacher";
  const destinations = [
    ["", w.overview, LayoutDashboard],
    ["curriculum", curriculumMessages.title, Compass],
    ["lessons", lessonMessages.title, BookOpenText],
    ["assessments", assessmentMessages.title, ClipboardList],
    [
      teacher ? "analytics" : "progress",
      teacher ? analyticsMessages.title : assessmentMessages.progress,
      ChartNoAxesColumnIncreasing,
    ],
    ["slides", slideMessages.title, Presentation],
  ] as const;
  function item(path: string, label: string, Icon: typeof Compass) {
    if (!classroom) return null;
    const href = `/dashboard/classrooms/${classroom.id}${path ? `/${path}` : ""}`;
    const active =
      pathname === href || (!!path && pathname.startsWith(`${href}/`));
    return (
      <Link
        key={path}
        href={href}
        aria-current={active ? "page" : undefined}
        className={buttonVariants({
          variant: active ? "default" : "ghost",
          className: "course-nav-link",
        })}
      >
        <Icon data-icon="inline-start" />
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <aside
      className="course-sidebar"
      aria-label={teacher ? m.teacherTools : m.studentTools}
    >
      <div className="workspace-shell-home course-identity">
        <span className="workspace-shell-mark" aria-hidden="true">
          OL
        </span>
        <span>
          <strong>{teacher ? w.teachingSpace : w.learningSpace}</strong>
          <small>{name}</small>
        </span>
      </div>
      <Link
        href="/dashboard"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "course-all-link",
        })}
      >
        <ArrowLeft data-icon="inline-start" />
        {w.allClassrooms}
      </Link>
      {teacher && (
        <Link
          href="/dashboard/settings/ai"
          aria-current={
            pathname === "/dashboard/settings/ai" ? "page" : undefined
          }
          className={buttonVariants({
            variant:
              pathname === "/dashboard/settings/ai" ? "default" : "outline",
            className: "course-nav-link",
          })}
        >
          <KeyRound data-icon="inline-start" />
          {teacherAiMessages.title}
        </Link>
      )}
      {classroom ? (
        <Field className="course-switcher">
          <FieldLabel htmlFor={`${role}-classroom`}>
            {teacher ? m.teachingClassroom : m.learningClassroom}
          </FieldLabel>
          <NativeSelect
            id={`${role}-classroom`}
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
        <p className="text-sm text-muted-foreground">
          {teacher ? m.createForTools : m.joinForTools}
        </p>
      )}
      {classroom && (
        <>
          <p className="course-nav-label">{w.workspace}</p>
          <nav
            className="course-nav-links"
            aria-label={teacher ? m.teacherTools : m.studentTools}
          >
            {destinations.map(([path, label, Icon]) => item(path, label, Icon))}
          </nav>
          {teacher && (
            <>
              <Separator />
              <p className="course-nav-label">{w.manage}</p>
              <nav className="course-nav-links" aria-label={w.manage}>
                {item("students", m.studentsNav, Users)}
                {item("edit", m.editClassroom, Settings2)}
              </nav>
            </>
          )}
          <p className="course-sidebar-note">
            {teacher ? w.teacherNote : w.studentNote}
          </p>
        </>
      )}
    </aside>
  );
}
