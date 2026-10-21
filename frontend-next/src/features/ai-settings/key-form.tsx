"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, KeyRound, ShieldCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormError } from "@/components/form-error";
import { sendRequest } from "@/lib/request";
import { teacherAiKeySchema, type TeacherAiStatus } from "./schema";
import { teacherAiMessages as m } from "@/lib/teacher-ai-messages";
import { messages } from "@/lib/messages";

export function TeacherAiKeyForm({ initial }: { initial: TeacherAiStatus }) {
  const router = useRouter();
  const id = useId();
  const [status, setStatus] = useState(initial);
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldError("");
    setNotice("");
    const parsed = teacherAiKeySchema.safeParse({ key });
    if (!parsed.success) {
      setFieldError(m.invalid);
      return;
    }
    setPending(true);
    try {
      const updated = await sendRequest<TeacherAiStatus>(
        "/api/settings/ai",
        parsed.data,
        "PUT",
      );
      setKey("");
      setStatus(updated);
      setNotice(m.saved);
      setConfirmRemove(false);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.serverError);
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    setPending(true);
    setError("");
    setNotice("");
    try {
      setStatus(
        await sendRequest<TeacherAiStatus>(
          "/api/settings/ai",
          undefined,
          "DELETE",
        ),
      );
      setKey("");
      setFieldError("");
      setConfirmRemove(false);
      setNotice(m.removed);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.serverError);
    } finally {
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            <h2 className="flex items-center gap-2">
              <KeyRound className="size-5" aria-hidden="true" />
              {m.provider}
            </h2>
          </CardTitle>
          <Badge variant={status.configured ? "secondary" : "outline"}>
            {status.configured ? m.configured : m.notConfigured}
          </Badge>
        </div>
        <CardDescription>{m.help}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!status.storageReady && (
          <Alert>
            <AlertDescription>{m.storageUnavailable}</AlertDescription>
          </Alert>
        )}
        <form
          onSubmit={save}
          noValidate
          aria-busy={pending}
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field
              data-invalid={Boolean(fieldError)}
              data-disabled={pending || !status.storageReady}
            >
              <FieldLabel htmlFor={id}>{m.keyLabel}</FieldLabel>
              <Input
                id={id}
                name="groq-api-key"
                type="password"
                value={key}
                onChange={(event) => {
                  setKey(event.target.value);
                  setFieldError("");
                }}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                maxLength={256}
                placeholder={m.placeholder}
                disabled={pending || !status.storageReady}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={`${id}-help ${id}-error`}
              />
              <FieldDescription id={`${id}-help`}>
                {m.fieldHelp}
              </FieldDescription>
              <FieldError id={`${id}-error`}>{fieldError}</FieldError>
            </Field>
          </FieldGroup>
          <Button
            type="submit"
            className="self-start"
            disabled={pending || !status.storageReady || !key.trim()}
          >
            {pending ? (
              <LoaderCircle
                data-icon="inline-start"
                className="motion-safe:animate-spin"
              />
            ) : (
              <Save data-icon="inline-start" />
            )}
            {pending
              ? messages.working
              : status.configured
                ? m.replace
                : m.save}
          </Button>
        </form>
        <FormError message={error} />
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {status.updatedAt && (
          <p className="text-xs text-muted-foreground">
            {m.updated}:{" "}
            {new Date(status.updatedAt).toLocaleDateString("en-IN", {
              timeZone: "UTC",
            })}
          </p>
        )}
        <Alert>
          <ShieldCheck aria-hidden="true" />
          <AlertDescription>{m.consent}</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-4">
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm underline underline-offset-4"
        >
          {m.getKey}
        </a>
        {status.configured &&
          (!confirmRemove ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmRemove(true)}
            >
              {m.remove}
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm">{m.removeWarning}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={remove}
                >
                  {m.confirmRemove}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirmRemove(false)}
                >
                  {messages.cancel}
                </Button>
              </div>
            </div>
          ))}
      </CardFooter>
    </Card>
  );
}
