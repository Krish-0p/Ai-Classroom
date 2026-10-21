"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { FormError } from "@/components/form-error";
import {
  classroomSchema,
  type ClassroomInput,
} from "@/features/classrooms/schema";
import { sendRequest } from "@/lib/request";
import { messages as m } from "@/lib/messages";
import { cn } from "@/lib/utils";

type Props = { id?: string; initial?: ClassroomInput };
export function ClassroomForm({ id, initial }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrors({});
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = classroomSchema.safeParse({
      ...data,
      durationWeeks: Number(data.durationWeeks),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setPending(true);
    try {
      const result = await sendRequest<{ id: string }>(
        id ? `/api/classrooms/${id}` : "/api/classrooms",
        parsed.data,
        id ? "PATCH" : "POST",
      );
      router.push(`/dashboard/classrooms/${result.id}`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : m.serverError);
      setPending(false);
    }
  }
  const fields = [
    {
      name: "name",
      label: m.courseName,
      placeholder: m.coursePlaceholder,
      max: 120,
    },
    {
      name: "academicLevel",
      label: m.academicLevel,
      placeholder: m.levelPlaceholder,
      max: 100,
    },
    {
      name: "language",
      label: m.language,
      placeholder: m.languagePlaceholder,
      max: 80,
    },
  ] as const;
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      className={cn("flex flex-col gap-6", id && "classroom-settings-form")}
    >
      <FieldGroup>
        {fields.map((field) => (
          <Field key={field.name} data-invalid={!!errors[field.name]}>
            <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              placeholder={field.placeholder}
              defaultValue={
                initial?.[field.name] ??
                (field.name === "language" ? m.languagePlaceholder : "")
              }
              maxLength={field.max}
              disabled={pending}
              aria-invalid={!!errors[field.name]}
              aria-describedby={`${field.name}-error`}
            />
            <FieldError id={`${field.name}-error`}>
              {errors[field.name]}
            </FieldError>
          </Field>
        ))}
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">{m.description}</FieldLabel>
          <Textarea
            id="description"
            name="description"
            defaultValue={initial?.description ?? ""}
            placeholder={m.descriptionPlaceholder}
            maxLength={2000}
            disabled={pending}
            aria-invalid={!!errors.description}
            aria-describedby="description-error"
          />
          <FieldError id="description-error">{errors.description}</FieldError>
        </Field>
        <Field data-invalid={!!errors.durationWeeks}>
          <FieldLabel htmlFor="durationWeeks">{m.durationWeeks}</FieldLabel>
          <Input
            id="durationWeeks"
            name="durationWeeks"
            type="number"
            min={1}
            max={104}
            step={1}
            defaultValue={initial?.durationWeeks ?? 12}
            disabled={pending}
            aria-invalid={!!errors.durationWeeks}
            aria-describedby="duration-error"
          />
          <FieldError id="duration-error">{errors.durationWeeks}</FieldError>
        </Field>
        <FieldSet disabled={pending}>
          <FieldLegend>{m.status}</FieldLegend>
          <FieldDescription>{m.archivedHelp}</FieldDescription>
          <FieldGroup>
            <Field orientation="horizontal">
              <input
                id="active"
                type="radio"
                name="status"
                value="active"
                defaultChecked={!initial || initial.status === "active"}
              />
              <FieldLabel htmlFor="active">{m.active}</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <input
                id="archived"
                type="radio"
                name="status"
                value="archived"
                defaultChecked={initial?.status === "archived"}
              />
              <FieldLabel htmlFor="archived">{m.archived}</FieldLabel>
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>
      <FormError message={error} />
      <Button type="submit" disabled={pending}>
        {pending && (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        )}
        {pending ? m.working : id ? m.saveClassroom : m.newClassroom}
      </Button>
    </form>
  );
}
