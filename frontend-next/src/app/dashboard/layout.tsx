import Link from "next/link";
import { requirePageActor } from "@/server/session";
import { LogoutButton } from "@/features/auth/logout-button";
import { messages as m } from "@/lib/messages";
import { listClassrooms } from "@/server/classrooms";
import { StudentNavigation } from "@/features/classrooms/student-navigation";
import { TeacherNavigation } from "@/features/classrooms/teacher-navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  const classrooms = await listClassrooms(actor);
  const navigationClassrooms = classrooms.map(({ id, name }) => ({ id, name }));
  return (
    <div className="workspace-shell">
      <div className="workspace-shell-header">
        <Link href="/dashboard" className="workspace-shell-home">
          <span className="workspace-shell-mark" aria-hidden="true">OL</span>
          <span><strong>{actor.role === "teacher" ? "Teaching space" : "Learning space"}</strong><small>{actor.name}</small></span>
        </Link>
        <div className="workspace-account">
          <span className={`workspace-role workspace-role-${actor.role}`}>{m[actor.role]}</span>
          <LogoutButton />
        </div>
      </div>
      {actor.role === "student" ? <StudentNavigation classrooms={navigationClassrooms} /> : <TeacherNavigation classrooms={navigationClassrooms} />}
      <div className="workspace-content">{children}</div>
    </div>
  );
}
