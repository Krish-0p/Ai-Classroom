"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { FormError } from "@/components/form-error";
import { sendRequest } from "@/lib/request";
import { assessmentMessages as m } from "@/lib/assessment-messages";
import { messages } from "@/lib/messages";
export function CreateAssessmentForm({
  classroomId,
  disabled,
}: {
  classroomId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          const result = await sendRequest<{ id: string }>(
            `/api/classrooms/${classroomId}/assessments`,
            { title },
          );
          router.push(
            `/dashboard/classrooms/${classroomId}/assessments/${result.id}`,
          );
        } catch (error) {
          setError(
            error instanceof Error ? error.message : messages.serverError,
          );
          setBusy(false);
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-assessment-title">{m.name}</FieldLabel>
          <Input
            id="new-assessment-title"
            required
            maxLength={160}
            value={title}
            disabled={busy || disabled}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
      </FieldGroup>
      <FormError message={error} />
      <Button type="submit" disabled={busy || disabled}>
        {busy ? messages.working : m.new}
      </Button>
    </form>
  );
}
export function StartAttemptButton({
  classroomId,
  assessmentId,
  disabled,
}: {
  classroomId: string;
  assessmentId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await sendRequest<{ id: string }>(
              `/api/classrooms/${classroomId}/assessments/${assessmentId}/attempts`,
              {},
            );
            router.push(
              `/dashboard/classrooms/${classroomId}/attempts/${result.id}`,
            );
          } catch (error) {
            setError(
              error instanceof Error ? error.message : messages.serverError,
            );
            setBusy(false);
          }
        }}
      >
        {busy ? messages.working : m.start}
      </Button>
      <FormError message={error} />
    </div>
  );
}
