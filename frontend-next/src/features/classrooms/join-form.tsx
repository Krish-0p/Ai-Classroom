"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import { FormError } from "@/components/form-error";
import { joinSchema } from "@/features/classrooms/schema";
import { sendRequest } from "@/lib/request";
import { messages as m } from "@/lib/messages";
export function JoinForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInvalid(null);
    const parsed = joinSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      setInvalid(parsed.error.issues[0].message);
      return;
    }
    setPending(true);
    try {
      const result = await sendRequest<{ id: string }>(
        "/api/classrooms/join",
        parsed.data,
      );
      router.push(`/dashboard/classrooms/${result.id}`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : m.serverError);
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-4"
    >
      <FieldGroup>
        <Field data-invalid={!!invalid}>
          <FieldLabel htmlFor="code">{m.joinCode}</FieldLabel>
          <Input
            id="code"
            name="code"
            placeholder={m.joinPlaceholder}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            disabled={pending}
            aria-invalid={!!invalid}
            aria-describedby="code-help code-error"
          />
          <FieldDescription id="code-help">{m.joinHelp}</FieldDescription>
          <FieldError id="code-error">{invalid}</FieldError>
        </Field>
      </FieldGroup>
      <FormError message={error} />
      <Button type="submit" disabled={pending}>
        {pending ? m.working : m.join}
      </Button>
    </form>
  );
}
