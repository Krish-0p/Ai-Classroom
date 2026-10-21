"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { KeyRound } from "lucide-react";
import { teacherAiMessages as m } from "@/lib/teacher-ai-messages";
import type { TeacherAiStatus } from "./schema";

export function TeacherAiSetupNotice({ status }: { status: TeacherAiStatus }) {
  const pathname = usePathname();
  if (
    (status.configured && status.storageReady) ||
    pathname === "/dashboard/settings/ai"
  )
    return null;
  return (
    <Alert>
      <KeyRound aria-hidden="true" />
      <AlertTitle>{m.setupTitle}</AlertTitle>
      <AlertDescription>
        <p>{status.storageReady ? m.setupHelp : m.storageUnavailable}</p>
        <Link
          href="/dashboard/settings/ai"
          className="underline underline-offset-4"
        >
          {m.open}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
