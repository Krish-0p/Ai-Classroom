"use client";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Save, Send, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SlidePlayer } from "./player";
import {
  slideDeckSchema,
  type SlideDeckInput,
  type SlideInput,
} from "./schema";
import type { SlideTeacherView } from "@/server/slides";
import { sendRequest } from "@/lib/request";
import { slideMessages as m } from "@/lib/slide-messages";
import { messages } from "@/lib/messages";
import { SectionTabs } from "@/components/workspace/section-tabs";
import { workspaceMessages as w } from "@/lib/workspace-messages";

type Job = {
  id: string;
  status: string;
  progress: number;
  error: string | null;
};
export function SlidesWorkspace({
  classroomId,
  initial,
  document: initialDocument,
  disabled,
}: {
  classroomId: string;
  initial: SlideTeacherView;
  document: SlideDeckInput;
  disabled: boolean;
}) {
  const router = useRouter();
  const prefix = useId();
  const [document, setDocument] = useState(initialDocument);
  const [saved, setSaved] = useState(initialDocument);
  const [version, setVersion] = useState(initial.version);
  const [job, setJob] = useState<Job | null>(initial.job);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [instruction, setInstruction] = useState("");
  const [count, setCount] = useState<4 | 5>(
    initialDocument.slides.length === 4 ? 4 : 5,
  );
  const running = job?.status === "queued" || job?.status === "generating";
  const dirty = JSON.stringify(document) !== JSON.stringify(saved);
  const stale = initial.draftCurriculumVersion !== initial.curriculumVersion;
  const base = `/api/classrooms/${classroomId}/slides`;
  useEffect(() => {
    if (!running || !job?.id) return;
    let canceled = false;
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const current = await sendRequest<Job>(
          `/api/classrooms/${classroomId}/jobs/${job.id}`,
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
      } finally {
        polling = false;
      }
    }, 2000);
    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, [running, job?.id, classroomId, router]);
  async function task(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.serverError);
    } finally {
      setBusy(false);
    }
  }
  function changeSlide(index: number, change: Partial<SlideInput>) {
    setDocument((current) => ({
      ...current,
      slides: current.slides.map((slide, position) =>
        position === index ? { ...slide, ...change } : slide,
      ),
    }));
    setNotice("");
  }
  return (
    <div className="slide-studio-layout">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{m.studio}</h2>
          </CardTitle>
          <CardDescription>{m.studioHelp}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{m.draft}</Badge>
            <Badge variant="outline">
              {initial.aiGenerated ? m.aiGenerated : m.outline}
            </Badge>
            {initial.publishedVersion > 0 && <Badge>{m.published}</Badge>}
          </div>
          {disabled && (
            <Alert>
              <AlertDescription>{m.archived}</AlertDescription>
            </Alert>
          )}
          {stale && (
            <Alert>
              <AlertDescription>{m.stale}</AlertDescription>
            </Alert>
          )}
          <fieldset disabled={disabled || busy || running} className="min-w-0">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${prefix}-count`}>{m.count}</FieldLabel>
                <NativeSelect
                  id={`${prefix}-count`}
                  value={count}
                  onChange={(event) =>
                    setCount(event.target.value === "4" ? 4 : 5)
                  }
                >
                  <NativeSelectOption value="4">4</NativeSelectOption>
                  <NativeSelectOption value="5">5</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-instruction`}>
                  {m.instruction}
                </FieldLabel>
                <Textarea
                  id={`${prefix}-instruction`}
                  value={instruction}
                  maxLength={500}
                  onChange={(event) => setInstruction(event.target.value)}
                />
                <FieldDescription>{m.instructionHint}</FieldDescription>
              </Field>
            </FieldGroup>
          </fieldset>
          <Button
            className="self-start"
            disabled={disabled || busy || running || dirty}
            onClick={() =>
              task(async () => {
                const result = await sendRequest<{ id: string }>(
                  `${base}/generate`,
                  { version, count, instruction },
                );
                setJob({
                  id: result.id,
                  status: "queued",
                  progress: 0,
                  error: null,
                });
              })
            }
          >
            <Sparkles data-icon="inline-start" />
            {m.generate}
          </Button>
          {running && (
            <p role="status" className="flex items-center gap-2 text-sm">
              <LoaderCircle
                data-icon="inline-start"
                className="size-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
              {job?.status === "queued" ? m.queued : m.generating}
            </p>
          )}
          {dirty && (
            <p role="status" className="text-sm text-muted-foreground">
              {m.saveFirst}
            </p>
          )}
          {(error || job?.status === "failed") && (
            <Alert variant="destructive">
              <AlertDescription>
                {error || job?.error || m.failed}
              </AlertDescription>
            </Alert>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={disabled || busy || running || (!dirty && version > 0)}
            onClick={() =>
              task(async () => {
                const parsed = slideDeckSchema.safeParse(document);
                if (!parsed.success)
                  throw new Error(parsed.error.issues[0].message);
                const result = await sendRequest<{ version: number }>(
                  base,
                  { version, deck: parsed.data },
                  "PATCH",
                );
                setVersion(result.version);
                setDocument(parsed.data);
                setSaved(parsed.data);
                setNotice(m.saved);
                if (stale) router.refresh();
              })
            }
          >
            <Save data-icon="inline-start" />
            {m.save}
          </Button>
          <Button
            disabled={
              disabled || busy || running || dirty || version === 0 || stale
            }
            onClick={() =>
              task(async () => {
                await sendRequest(`${base}/status`, {
                  version,
                  action: "publish",
                });
                router.refresh();
              })
            }
          >
            <Send data-icon="inline-start" />
            {m.publish}
          </Button>
          {initial.publishedVersion > 0 && (
            <Button
              variant="ghost"
              disabled={disabled || busy || running || dirty}
              onClick={() =>
                task(async () => {
                  await sendRequest(`${base}/status`, {
                    version,
                    action: "unpublish",
                  });
                  router.refresh();
                })
              }
            >
              {m.unpublish}
            </Button>
          )}
        </CardFooter>
      </Card>
      <div className="slide-studio-main">
        <SectionTabs
          label={m.studio}
          sections={[
            {
              id: "preview",
              label: w.present,
              content: (
                <section aria-label={m.preview}>
                  <SlidePlayer deck={document} concepts={initial.concepts} />
                </section>
              ),
            },
            {
              id: "edit",
              label: w.edit,
              content: (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h2>{m.edit}</h2>
                    </CardTitle>
                    <CardDescription>{m.review}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex min-w-0 flex-col gap-5">
                      <FieldGroup>
                        <Field>
                          <FieldLabel htmlFor={`${prefix}-title`}>
                            {m.deckTitle}
                          </FieldLabel>
                          <Input
                            id={`${prefix}-title`}
                            disabled={disabled || busy || running}
                            value={document.title}
                            maxLength={160}
                            onChange={(event) =>
                              setDocument({
                                ...document,
                                title: event.target.value,
                              })
                            }
                          />
                        </Field>
                      </FieldGroup>
                      <SectionTabs
                        outline
                        disabledContent={disabled || busy || running}
                        label={m.edit}
                        sections={document.slides.map((slide, index) => ({
                          id: String(index),
                          label: `${m.slide} ${index + 1}: ${slide.heading}`,
                          content: (
                            <FieldGroup>
                              <Field>
                                <FieldLabel
                                  htmlFor={`${prefix}-heading-${index}`}
                                >
                                  {m.heading}
                                </FieldLabel>
                                <Input
                                  id={`${prefix}-heading-${index}`}
                                  value={slide.heading}
                                  maxLength={160}
                                  onChange={(event) =>
                                    changeSlide(index, {
                                      heading: event.target.value,
                                    })
                                  }
                                />
                              </Field>
                              <Field>
                                <FieldLabel
                                  htmlFor={`${prefix}-explanation-${index}`}
                                >
                                  {m.explanation}
                                </FieldLabel>
                                <Textarea
                                  id={`${prefix}-explanation-${index}`}
                                  value={slide.explanation}
                                  maxLength={650}
                                  onChange={(event) =>
                                    changeSlide(index, {
                                      explanation: event.target.value,
                                    })
                                  }
                                />
                              </Field>
                              <Field>
                                <FieldLabel
                                  htmlFor={`${prefix}-bullets-${index}`}
                                >
                                  {m.bullets}
                                </FieldLabel>
                                <Textarea
                                  id={`${prefix}-bullets-${index}`}
                                  value={slide.bullets.join("\n")}
                                  onChange={(event) =>
                                    changeSlide(index, {
                                      bullets: event.target.value.split("\n"),
                                    })
                                  }
                                />
                              </Field>
                              <Field>
                                <FieldLabel
                                  htmlFor={`${prefix}-example-${index}`}
                                >
                                  {m.example}
                                </FieldLabel>
                                <Textarea
                                  id={`${prefix}-example-${index}`}
                                  value={slide.example}
                                  maxLength={450}
                                  onChange={(event) =>
                                    changeSlide(index, {
                                      example: event.target.value,
                                    })
                                  }
                                />
                              </Field>
                              <Field>
                                <FieldLabel
                                  htmlFor={`${prefix}-takeaway-${index}`}
                                >
                                  {m.takeaway}
                                </FieldLabel>
                                <Input
                                  id={`${prefix}-takeaway-${index}`}
                                  value={slide.takeaway}
                                  maxLength={240}
                                  onChange={(event) =>
                                    changeSlide(index, {
                                      takeaway: event.target.value,
                                    })
                                  }
                                />
                              </Field>
                            </FieldGroup>
                          ),
                        }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
