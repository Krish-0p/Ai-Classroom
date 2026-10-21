"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/form-error";
import {
  assessmentSchema,
  generationOptionsSchema,
  publicQuestion,
  type AssessmentInput,
  type GenerationOptions,
} from "./schema";
import { newQuestion, QuestionEditor } from "./question-editor";
import { QuestionInputControl } from "./question-input";
import { assessmentMessages as m } from "@/lib/assessment-messages";
import { messages } from "@/lib/messages";
import { sendRequest } from "@/lib/request";
import { SectionTabs } from "@/components/workspace/section-tabs";
import { Progress } from "@/components/ui/progress";
import { workspaceMessages as w } from "@/lib/workspace-messages";
type Job = {
  id: string;
  status: string;
  progress: number;
  error: string | null;
};
export function AssessmentEditor({
  classroomId,
  assessmentId,
  initial,
  initialVersion,
  publishedVersion,
  status,
  initialJob,
  concepts,
  disabled,
}: {
  classroomId: string;
  assessmentId: string;
  initial: AssessmentInput;
  initialVersion: number;
  publishedVersion: number;
  status: string;
  initialJob: Job | null;
  concepts: { id: string; title: string }[];
  disabled: boolean;
}) {
  const router = useRouter();
  const base = `/api/classrooms/${classroomId}/assessments/${assessmentId}`;
  const [document, setDocument] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [job, setJob] = useState(initialJob);
  const [options, setOptions] = useState<GenerationOptions>({
    conceptIds: [
      ...new Set(initial.questions.flatMap((q) => q.conceptIds)),
    ].slice(0, 10),
    easy: 1,
    medium: 2,
    hard: 1,
  });
  const running = job?.status === "queued" || job?.status === "generating";
  const jobId = job?.id;
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
  const change = (next: AssessmentInput) => {
    setDocument(next);
    setDirty(true);
    setNotice("");
  };
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
    const parsed = assessmentSchema.safeParse(document);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    await task(async () => {
      const result = await sendRequest<{ version: number }>(
        base,
        { version, assessment: parsed.data },
        "PATCH",
      );
      setVersion(result.version);
      setDocument(parsed.data);
      setSaved(parsed.data);
      setDirty(false);
      setNotice(m.saved);
    });
  }
  async function publish(action: "publish" | "unpublish" | "archive") {
    await task(async () => {
      const result = await sendRequest<{ version: number }>(`${base}/status`, {
        version,
        action,
      });
      setVersion(result.version);
      setNotice(m.statusSaved);
      router.refresh();
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{m.studio}</h2>
        </CardTitle>
        <CardDescription>{m.teacherHelp}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary">
            {status === "published"
              ? m.published
              : status === "archived"
                ? m.archived
                : m.draft}
          </Badge>
          {status === "published" && version > publishedVersion && (
            <span className="text-sm">{m.changed}</span>
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
                      <FieldLabel htmlFor="assessment-title">
                        {m.name}
                      </FieldLabel>
                      <Input
                        id="assessment-title"
                        maxLength={160}
                        value={document.title}
                        onChange={(e) =>
                          change({ ...document, title: e.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="assessment-instructions">
                        {m.instructions}
                      </FieldLabel>
                      <Textarea
                        id="assessment-instructions"
                        value={document.instructions}
                        maxLength={4000}
                        onChange={(e) =>
                          change({ ...document, instructions: e.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="assessment-attempts">
                        {m.maxAttempts}
                      </FieldLabel>
                      <Input
                        id="assessment-attempts"
                        type="number"
                        min={1}
                        max={5}
                        value={document.maxAttempts}
                        onChange={(e) =>
                          change({
                            ...document,
                            maxAttempts: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={document.showSolutions}
                        onChange={(e) =>
                          change({
                            ...document,
                            showSolutions: e.target.checked,
                          })
                        }
                      />
                      {m.showSolutions}
                    </label>
                  </FieldGroup>
                ),
              },
              ...document.questions.map((q, index) => ({
                id: q.id,
                label: `${index + 1}. ${q.prompt.slice(0, 72) || w.question}${q.prompt.length > 72 ? "…" : ""}`,
                content: (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    index={index}
                    count={document.questions.length}
                    concepts={concepts}
                    update={(next) =>
                      change({
                        ...document,
                        questions: document.questions.map((item) =>
                          item.id === q.id ? next : item,
                        ),
                      })
                    }
                    remove={() =>
                      change({
                        ...document,
                        questions: document.questions.filter(
                          (item) => item.id !== q.id,
                        ),
                      })
                    }
                    move={(delta) => {
                      const next = [...document.questions];
                      [next[index], next[index + delta]] = [
                        next[index + delta],
                        next[index],
                      ];
                      change({ ...document, questions: next });
                    }}
                  />
                ),
              })),
              {
                id: "generate",
                label: w.generation,
                content: (
                  <FieldSet>
                    <FieldLegend>{m.generate}</FieldLegend>
                    <p className="text-sm text-muted-foreground">
                      {m.generationHelp}
                    </p>
                    <FieldSet>
                      <FieldLegend variant="label">{m.concepts}</FieldLegend>
                      <div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">
                        {concepts.map((concept) => (
                          <label
                            key={concept.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={options.conceptIds.includes(concept.id)}
                              onChange={(e) =>
                                setOptions({
                                  ...options,
                                  conceptIds: e.target.checked
                                    ? [...options.conceptIds, concept.id]
                                    : options.conceptIds.filter(
                                        (id) => id !== concept.id,
                                      ),
                                })
                              }
                            />
                            {concept.title}
                          </label>
                        ))}
                      </div>
                    </FieldSet>
                    <FieldGroup className="sm:grid sm:grid-cols-3">
                      {(["easy", "medium", "hard"] as const).map(
                        (difficulty) => (
                          <Field key={difficulty}>
                            <FieldLabel htmlFor={`count-${difficulty}`}>
                              {m[difficulty]}
                            </FieldLabel>
                            <Input
                              id={`count-${difficulty}`}
                              type="number"
                              min={0}
                              max={20}
                              value={options[difficulty]}
                              onChange={(e) =>
                                setOptions({
                                  ...options,
                                  [difficulty]: Number(e.target.value),
                                })
                              }
                            />
                          </Field>
                        ),
                      )}
                    </FieldGroup>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={dirty || !concepts.length}
                      onClick={() => {
                        const parsed =
                          generationOptionsSchema.safeParse(options);
                        if (!parsed.success) {
                          setError(parsed.error.issues[0].message);
                          return;
                        }
                        void task(async () => {
                          const result = await sendRequest<{ id: string }>(
                            `${base}/generate`,
                            { version, options: parsed.data },
                          );
                          setJob({
                            id: result.id,
                            status: "queued",
                            progress: 0,
                            error: null,
                          });
                        });
                      }}
                    >
                      {m.generate}
                    </Button>
                  </FieldSet>
                ),
              },
            ]}
          />
          {!concepts.length && <p>{m.noConcepts}</p>}
          <Button
            type="button"
            variant="outline"
            disabled={
              disabled ||
              busy ||
              running ||
              document.questions.length >= 30 ||
              !concepts.length
            }
            onClick={() =>
              change({
                ...document,
                questions: [...document.questions, newQuestion()],
              })
            }
          >
            {m.addQuestion}
          </Button>
          <fieldset
            disabled={disabled || busy || running}
            className="workspace-save-bar"
          >
            <p role="status">{dirty ? w.unsaved : w.saved}</p>
            <Button type="button" onClick={save}>
              {m.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={dirty || !saved.questions.length}
              onClick={() => publish("publish")}
            >
              {m.publish}
            </Button>
            {status === "published" && (
              <Button
                type="button"
                variant="outline"
                disabled={dirty}
                onClick={() => publish("unpublish")}
              >
                {m.unpublish}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={dirty}
              onClick={() => publish("archive")}
            >
              {m.archive}
            </Button>
          </fieldset>
        </div>
        {job && (
          <div role="status">
            <p className="text-sm">
              {job.status === "complete"
                ? m.generated
                : job.status === "failed"
                  ? job.error || m.generationFailed
                  : job.status === "queued"
                    ? m.queued
                    : m.generating}
            </p>
            {running && (
              <Progress
                className="w-full"
                aria-label={m.generating}
                max={100}
                value={job.progress}
              />
            )}
          </div>
        )}
        <FormError message={error} />
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-semibold">
            {m.preview}
          </summary>
          <div className="mt-4 flex flex-col gap-6">
            {saved.questions.map((q) => (
              <section key={q.id} className="flex flex-col gap-3">
                <h3 className="whitespace-pre-wrap font-medium">{q.prompt}</h3>
                <QuestionInputControl
                  question={publicQuestion(q)}
                  value=""
                  onChange={() => {}}
                  disabled
                />
                <details>
                  <summary>{m.answerPreview}</summary>
                  <p className="whitespace-pre-wrap text-sm">
                    {q.type === "numerical"
                      ? `${q.numericAnswer} ± ${q.tolerance}`
                      : q.answerIds
                          .map(
                            (id) =>
                              q.options.find((option) => option.id === id)
                                ?.text,
                          )
                          .join(", ")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{q.explanation}</p>
                </details>
              </section>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
