import { requirePageActor } from "@/server/session";
import { listClassrooms } from "@/server/classrooms";
import { CourseNavigation } from "@/features/classrooms/course-navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requirePageActor();
  const classrooms = await listClassrooms(actor);
  const navigationClassrooms = classrooms.map(({ id, name }) => ({ id, name }));
  return (
    <div className="workspace-shell">
      <div className="workspace-body">
        <CourseNavigation
          classrooms={navigationClassrooms}
          role={actor.role}
          name={actor.name}
        />
        <div className="workspace-content">{children}</div>
      </div>
    </div>
  );
}
