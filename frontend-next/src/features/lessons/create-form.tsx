"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-error";
import { sendRequest } from "@/lib/request";
import { messages } from "@/lib/messages";
import { lessonMessages as m } from "@/lib/lesson-messages";
export function CreateLessonForm({
  classroomId,
  concepts,
  disabled,
}: {
  classroomId: string;
  concepts: { id: string; title: string; unit: { title: string } }[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [conceptId, setConceptId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (!conceptId) {
          setError(m.missingConcept);
          return;
        }
        setBusy(true);
        setError("");
        try {
          const lesson = await sendRequest<{ id: string }>(
            `/api/classrooms/${classroomId}/lessons`,
            { conceptId },
          );
          router.push(
            `/dashboard/classrooms/${classroomId}/lessons/${lesson.id}`,
          );
        } catch (error) {
          setError(
            error instanceof Error ? error.message : messages.serverError,
          );
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="lesson-concept">{m.concept}</FieldLabel>
          <select
            id="lesson-concept"
            value={conceptId}
            disabled={disabled || busy}
            className="h-10 w-full rounded-lg border bg-background px-3"
            onChange={(event) => setConceptId(event.target.value)}
          >
            <option value="">{m.pickConcept}</option>
            {concepts.map((concept) => (
              <option key={concept.id} value={concept.id}>
                {concept.unit.title} · {concept.title}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>
      <FormError message={error} />
      <Button type="submit" disabled={disabled || busy || !concepts.length}>
        {busy ? messages.working : m.new}
      </Button>
    </form>
  );
}
