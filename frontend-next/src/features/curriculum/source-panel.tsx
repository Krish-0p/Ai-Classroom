"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
import { messages } from "@/lib/messages";
import { sendRequest } from "@/lib/request";
import { pasteSchema } from "./schema";
import { MAX_SOURCE_BYTES } from "@/lib/source-limits";
import { Progress } from "@/components/ui/progress";
type Job = {
  id: string;
  status: string;
  progress: number;
  error: string | null;
};
type Props = {
  classroomId: string;
  sources: { id: string; filename: string }[];
  initialJob: Job | null;
  disabled: boolean;
};
export function SourcePanel({
  classroomId,
  sources,
  initialJob,
  disabled,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(sources.map((source) => source.id));
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState(initialJob);
  const running = job?.status === "queued" || job?.status === "generating";
  const jobId = job?.id;
  useEffect(() => {
    if (!running || !jobId || disabled) return;
    let canceled = false;
    const timer = setInterval(async () => {
      try {
        const current = await sendRequest<Job>(
          `/api/classrooms/${classroomId}/curriculum/jobs/${jobId}`,
          undefined,
          "GET",
        );
        if (canceled) return;
        setJob(current);
        setError("");
        if (current.status === "complete" || current.status === "failed")
          router.refresh();
      } catch (error) {
        if (!canceled)
          setError(
            error instanceof Error ? error.message : messages.serverError,
          );
      }
    }, 2000);
    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, [running, jobId, classroomId, disabled, router]);
  async function task(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.serverError);
    } finally {
      setBusy(false);
    }
  }
  async function paste() {
    const parsed = pasteSchema.safeParse({ filename: name, text });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    await task(async () => {
      const source = await sendRequest<{ id: string }>(
        `/api/classrooms/${classroomId}/sources`,
        parsed.data,
      );
      setSelected((previous) => [...new Set([...previous, source.id])]);
      setName("");
      setText("");
    });
  }
  async function upload() {
    if (!file) return;
    await task(async () => {
      if (file.size > MAX_SOURCE_BYTES) throw new Error(m.tooLarge);
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/classrooms/${classroomId}/sources`, {
        method: "POST",
        body: form,
      });
      const body: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          body &&
            typeof body === "object" &&
            "error" in body &&
            typeof body.error === "string"
            ? body.error
            : messages.serverError,
        );
      if (
        body &&
        typeof body === "object" &&
        "id" in body &&
        typeof body.id === "string"
      ) {
        const id = body.id;
        setSelected((previous) => [...new Set([...previous, id])]);
      }
      setFile(null);
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{m.sources}</h2>
        </CardTitle>
        <CardDescription>{m.sourceHelp}</CardDescription>
      </CardHeader>
      <CardContent className="source-workspace">
        <fieldset
          disabled={busy || disabled}
          className="flex min-w-0 flex-col gap-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="source-name">{m.sourceName}</FieldLabel>
              <Input
                id="source-name"
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="source-text">{m.sourceText}</FieldLabel>
              <Textarea
                id="source-text"
                maxLength={120000}
                rows={5}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <Button type="button" variant="outline" onClick={paste}>
            {m.paste}
          </Button>
          <Field>
            <FieldLabel htmlFor="source-file">{m.file}</FieldLabel>
            <Input
              id="source-file"
              type="file"
              accept=".pdf,.docx,.pptx,.txt"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={!file}
            onClick={upload}
          >
            {m.upload}
          </Button>
        </fieldset>
        <div className="flex min-w-0 flex-col gap-5">
          {sources.length ? (
            <ul className="flex flex-col gap-3">
              {sources.map((source) => (
                <li
                  key={source.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <input
                    type="checkbox"
                    aria-label={`${m.selection}: ${source.filename}`}
                    checked={selected.includes(source.id)}
                    disabled={busy || running || disabled}
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, source.id]
                          : previous.filter((id) => id !== source.id),
                      )
                    }
                  />
                  <a
                    href={`/api/classrooms/${classroomId}/sources/${source.id}`}
                    className="break-all text-sm underline underline-offset-4"
                  >
                    {source.filename}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{m.noSources}</EmptyTitle>
                <EmptyDescription>{m.noSourcesHelp}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <p className="text-sm text-muted-foreground">{m.generateHelp}</p>
          <Button
            type="button"
            disabled={busy || running || disabled || !selected.length}
            onClick={() =>
              task(async () => {
                const response = await sendRequest<{ id: string }>(
                  `/api/classrooms/${classroomId}/curriculum/generate`,
                  { sourceIds: selected },
                );
                setJob({
                  id: response.id,
                  status: "queued",
                  progress: 0,
                  error: null,
                });
              })
            }
          >
            {busy ? messages.working : m.generate}
          </Button>
          {job && (
            <div role="status" className="flex flex-col gap-2 text-sm">
              <p>
                {job.status === "complete"
                  ? m.complete
                  : job.status === "failed"
                    ? job.error || m.failed
                    : job.status === "queued"
                      ? m.queued
                      : m.generating}
              </p>
              {running && (
                <>
                  <Progress
                    aria-label={m.generating}
                    value={job.progress}
                    max={100}
                    className="w-full"
                  />
                  <p className="text-muted-foreground">{m.pendingHelp}</p>
                </>
              )}
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription role="alert">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
