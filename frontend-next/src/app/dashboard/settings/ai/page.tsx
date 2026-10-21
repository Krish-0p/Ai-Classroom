import { redirect } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readTeacherAiStatus } from "@/server/teacher-ai-settings";
import { TeacherAiKeyForm } from "@/features/ai-settings/key-form";
import { WorkspacePageHeader } from "@/components/workspace/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { teacherAiMessages as m } from "@/lib/teacher-ai-messages";

export default async function AiSettingsPage() {
  const actor = await requirePageActor();
  if (actor.role !== "teacher") redirect("/dashboard");
  const status = await readTeacherAiStatus(actor);
  return (
    <div className="learning-page">
      <WorkspacePageHeader
        title={m.title}
        eyebrow={m.eyebrow}
        description={m.description}
      />
      <div className="settings-layout">
        <TeacherAiKeyForm initial={status} />
        <aside>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{m.securityTitle}</h2>
              </CardTitle>
              <CardDescription>{m.securityHelp}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{m.consent}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
