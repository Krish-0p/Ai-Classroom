import { requirePageActor } from "@/server/session";
import { listClassrooms } from "@/server/classrooms";
import { CourseNavigation } from "@/features/classrooms/course-navigation";
import { readTeacherAiStatus } from "@/server/teacher-ai-settings";
import { TeacherAiSetupNotice } from "@/features/ai-settings/setup-notice";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requirePageActor();
  const classrooms = await listClassrooms(actor);
  const aiStatus =
    actor.role === "teacher" ? await readTeacherAiStatus(actor) : null;
  const navigationClassrooms = classrooms.map(({ id, name }) => ({ id, name }));
  return (
    <div className="workspace-shell">
      <div className="workspace-body">
        <CourseNavigation
          classrooms={navigationClassrooms}
          role={actor.role}
          name={actor.name}
        />
        <div className="workspace-content">
          {aiStatus && <TeacherAiSetupNotice status={aiStatus} />}
          {children}
        </div>
      </div>
    </div>
  );
}
