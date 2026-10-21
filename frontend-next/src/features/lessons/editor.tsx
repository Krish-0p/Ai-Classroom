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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  lessonSchema,
  type LessonInput,
  type LessonAction,
  type LessonBlockInput,
} from "./schema";
import { BlockEditor, blockTypes, newLessonBlock } from "./block-editor";
import { LessonPlayer } from "./player";
import { sendRequest } from "@/lib/request";
import { lessonMessages as m } from "@/lib/lesson-messages";
import { messages } from "@/lib/messages";
import { SectionTabs } from "@/components/workspace/section-tabs";
import { Progress } from "@/components/ui/progress";
import { workspaceMessages as w } from "@/lib/workspace-messages";
type Job = {
  id: string;
  status: string;
  progress: number;
  error: string | null;
};
type Status = "draft" | "review" | "published" | "archived";
type Props = {
  classroomId: string;
  lessonId: string;
  initial: LessonInput;
  initialVersion: number;
  initialStatus: Status;
  publishedVersion: number;
  initialJob: Job | null;
  disabled: boolean;
};
export function LessonEditor({
  classroomId,
  lessonId,
  initial,
  initialVersion,
  initialStatus,
  publishedVersion,
  initialJob,
  disabled,
}: Props) {
  const router = useRouter();
  const [document, setDocument] = useState(initial);
  const [savedDocument, setSavedDocument] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState(initialStatus);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [instruction, setInstruction] = useState("");
  const [newType, setNewType] = useState<LessonBlockInput["type"]>("text");
  const [job, setJob] = useState(initialJob);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const jobId = job?.id;
  const running = job?.status === "queued" || job?.status === "generating";
  const base = `/api/classrooms/${classroomId}/lessons/${lessonId}`;
  useEffect(() => {
    if (!running || !jobId) return;
    let canceled = false;
    const timer = setInterval(async () => {
      try {
        const current = await sendRequest<Job>(
          `/api/classrooms/${classroomId}/jobs/${jobId}`,
          undefined,
          "GET",
        );
        if (canceled) return;
        setJob(current);
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
  }, [running, jobId, classroomId, router]);
  function change(next: LessonInput) {
    setDocument(next);
    setDirty(true);
    setNotice("");
  }
  async function task(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.serverError);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const parsed = lessonSchema.safeParse(document);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    await task(async () => {
      const result = await sendRequest<{ version: number }>(
        base,
        { version, lesson: parsed.data },
        "PATCH",
      );
      setVersion(result.version);
      setDocument(parsed.data);
      setSavedDocument(parsed.data);
      setDirty(false);
      setNotice(m.saved);
      if (status === "review") setStatus("draft");
    });
  }
  async function changeStatus(action: LessonAction) {
    await task(async () => {
      const result = await sendRequest<{ version: number }>(`${base}/status`, {
        version,
        action,
      });
      setVersion(result.version);
      setStatus(
        action === "publish"
          ? "published"
          : action === "unpublish"
            ? "draft"
            : action === "archive"
              ? "archived"
              : "review",
      );
      setNotice(
        action === "publish"
          ? m.publishedNotice
          : action === "unpublish"
            ? m.unpublishedNotice
            : action === "archive"
              ? m.archivedNotice
              : m.reviewNotice,
      );
      router.refresh();
    });
  }
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{m.studio}</h2>
          </CardTitle>
          <CardDescription>{m.draftHelp}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">
              {status === "review" ? m.reviewStatus : m[status]}
            </Badge>
            {status === "published" && version > publishedVersion && (
              <p className="text-sm text-muted-foreground">
                {m.unpublishedChanges}
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <SectionTabs
              outline
              disabledContent={disabled || busy || running}
              label={m.studio}
              sections={[
                {
                  id: "settings",
                  label: w.details,
                  content: (
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="lesson-title">
                          {m.lessonTitle}
                        </FieldLabel>
                        <Input
                          id="lesson-title"
                          value={document.title}
                          maxLength={160}
                          onChange={(event) =>
                            change({ ...document, title: event.target.value })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="lesson-minutes">
                          {m.minutes}
                        </FieldLabel>
                        <Input
                          id="lesson-minutes"
                          type="number"
                          min={1}
                          max={180}
                          value={document.estimatedMinutes}
                          onChange={(event) =>
                            change({
                              ...document,
                              estimatedMinutes: Number(event.target.value),
                            })
                          }
                        />
                      </Field>
                    </FieldGroup>
                  ),
                },
                ...document.blocks.map((block, index) => ({
                  id: block.id,
                  label: `${index + 1}. ${block.title || m[block.type]}`,
                  content: (
                    <BlockEditor
                      key={block.id}
                      block={block}
                      index={index}
                      count={document.blocks.length}
                      update={(next) =>
                        change({
                          ...document,
                          blocks: document.blocks.map((existing) =>
                            existing.id === block.id ? next : existing,
                          ),
                        })
                      }
                      remove={() =>
                        change({
                          ...document,
                          blocks: document.blocks.filter(
                            (existing) => existing.id !== block.id,
                          ),
                        })
                      }
                      move={(delta) => {
                        const blocks = [...document.blocks];
                        [blocks[index], blocks[index + delta]] = [
                          blocks[index + delta],
                          blocks[index],
                        ];
                        change({ ...document, blocks });
                      }}
                    />
                  ),
                })),
                {
                  id: "generate",
                  label: w.generation,
                  content: (
                    <div className="flex flex-col gap-5">
                      <Field>
                        <FieldLabel htmlFor="lesson-instruction">
                          {m.instruction}
                        </FieldLabel>
                        <Textarea
                          id="lesson-instruction"
                          value={instruction}
                          maxLength={1000}
                          placeholder={m.instructionPlaceholder}
                          onChange={(event) =>
                            setInstruction(event.target.value)
                          }
                        />
                      </Field>
                      <p className="text-sm text-muted-foreground">
                        {m.generationHelp}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={dirty}
                        onClick={() =>
                          task(async () => {
                            const result = await sendRequest<{ id: string }>(
                              `${base}/generate`,
                              { version, instruction },
                            );
                            setJob({
                              id: result.id,
                              status: "queued",
                              progress: 0,
                              error: null,
                            });
                            setNotice("");
                          })
                        }
                      >
                        {m.generate}
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
            <Field>
              <FieldLabel htmlFor="new-block-type">{m.blockType}</FieldLabel>
              <select
                disabled={disabled || busy || running}
                id="new-block-type"
                className="h-10 w-full rounded-lg border bg-background px-3"
                value={newType}
                onChange={(event) =>
                  setNewType(event.target.value as LessonBlockInput["type"])
                }
              >
                {blockTypes.map((type) => (
                  <option key={type} value={type}>
                    {m[type]}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="button"
              variant="outline"
              disabled={
                disabled || busy || running || document.blocks.length >= 40
              }
              onClick={() =>
                change({
                  ...document,
                  blocks: [...document.blocks, newLessonBlock(newType)],
                })
              }
            >
              {m.addBlock}
            </Button>
            <fieldset
              disabled={disabled || busy || running}
              className="workspace-save-bar"
            >
              <p role="status">{dirty ? w.unsaved : w.saved}</p>
              <Button type="button" onClick={save}>
                {busy ? messages.working : m.save}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={dirty || !savedDocument.blocks.length}
                onClick={() => changeStatus("publish")}
              >
                {m.publish}
              </Button>
              {status !== "published" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={dirty || !savedDocument.blocks.length}
                  onClick={() => changeStatus("review")}
                >
                  {m.review}
                </Button>
              )}
              {status === "published" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={dirty}
                  onClick={() => changeStatus("unpublish")}
                >
                  {m.unpublish}
                </Button>
              )}
              {status !== "archived" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={dirty}
                  onClick={() => changeStatus("archive")}
                >
                  {m.archive}
                </Button>
              )}
            </fieldset>
          </div>
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
                    max={100}
                    value={job.progress}
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
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {!confirmDelete ? (
              <Button
                type="button"
                variant="destructive"
                disabled={disabled || busy || running}
                onClick={() => setConfirmDelete(true)}
              >
                {m.delete}
              </Button>
            ) : (
              <>
                <p>{m.deleteWarning}</p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy || disabled || running}
                    onClick={() =>
                      task(async () => {
                        await sendRequest(base, undefined, "DELETE");
                        router.push(
                          `/dashboard/classrooms/${classroomId}/lessons`,
                        );
                        router.refresh();
                      })
                    }
                  >
                    {m.confirmDelete}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                  >
                    {messages.cancel}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-semibold">{m.preview}</summary>
        <p className="my-4 text-sm text-muted-foreground">{m.previewHelp}</p>
        <LessonPlayer key={version} lesson={savedDocument} />
      </details>
    </div>
  );
}
