"use client";
import { useEffect, useRef, useState } from "react";
import type { TutorView } from "@/server/tutor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/form-error";
import { sendRequest } from "@/lib/request";
import { tutorMessages as m } from "@/lib/tutor-messages";
export function TutorWorkspace({
  classroomId,
  initial,
  disabled,
}: {
  classroomId: string;
  initial: TutorView;
  disabled: boolean;
}) {
  const [data, setData] = useState(initial),
    [question, setQuestion] = useState(""),
    [lessonId, setLessonId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useRef<{
    question: string;
    lessonId: string;
    id: string;
  } | null>(null);
  const base = `/api/classrooms/${classroomId}/tutor`;
  const active = data.messages.some((message) =>
    ["queued", "generating"].includes(message.status),
  );
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const next = await sendRequest<TutorView>(base, undefined, "GET");
        if (!stopped) setData(next);
      } catch (error) {
        if (!stopped)
          setError(error instanceof Error ? error.message : m.error);
      }
    }, 2500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [base, active]);
  async function refresh() {
    setData(await sendRequest<TutorView>(base, undefined, "GET"));
  }
  return (
    <div className="tutor-thread">
      <Card>
        <CardHeader>
          <CardTitle>{m.question}</CardTitle>
          <CardDescription>{m.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (
                  !request.current ||
                  request.current.question !== question ||
                  request.current.lessonId !== lessonId
                )
                  request.current = {
                    question,
                    lessonId,
                    id: crypto.randomUUID(),
                  };
                await sendRequest(base, {
                  question,
                  requestId: request.current.id,
                  ...(lessonId ? { lessonId } : {}),
                });
                request.current = null;
                setQuestion("");
                await refresh();
              } catch (error) {
                setError(error instanceof Error ? error.message : m.error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="tutor-lesson">{m.lesson}</FieldLabel>
                <NativeSelect
                  id="tutor-lesson"
                  value={lessonId}
                  disabled={disabled || busy || active}
                  onChange={(e) => setLessonId(e.target.value)}
                >
                  <NativeSelectOption value="">{m.noLesson}</NativeSelectOption>
                  {data.lessons.map((lesson) => (
                    <NativeSelectOption key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="tutor-question">{m.question}</FieldLabel>
                <Textarea
                  id="tutor-question"
                  value={question}
                  minLength={3}
                  maxLength={2000}
                  required
                  disabled={disabled || busy || active}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </Field>
            </FieldGroup>
            <Button
              type="submit"
              disabled={
                disabled || busy || active || question.trim().length < 3
              }
            >
              {busy || active ? m.pending : m.ask}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <FormError message={error} />
        </CardFooter>
      </Card>
      {!data.messages.length && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{m.empty}</EmptyTitle>
            <EmptyDescription>{m.emptyHelp}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <section
        aria-label={m.title}
        className="flex flex-col gap-4"
        aria-live="polite"
      >
        {data.messages.map((message) => (
          <Card key={message.id}>
            <CardHeader>
              <CardTitle>
                <h2 className="whitespace-pre-wrap break-words">
                  {message.question}
                </h2>
              </CardTitle>
              <CardDescription>
                <Badge variant="outline">
                  {m[
                    message.status as
                      "queued" | "generating" | "complete" | "failed"
                  ] ?? message.status}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {message.answer && (
                <p className="whitespace-pre-wrap break-words leading-relaxed">
                  {message.answer}
                </p>
              )}
              <FormError message={message.error} />
              {message.citations.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-medium">
                    {m.source}
                  </summary>
                  <ul className="mt-3 flex flex-col gap-4">
                    {message.citations.map((citation) => (
                      <li key={citation.id}>
                        <p className="font-medium">
                          {citation.filename} · {citation.label}
                        </p>
                        <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 pl-3 text-sm text-muted-foreground">
                          {citation.text}
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-2">
              {message.status === "failed" && (
                <Button
                  variant="outline"
                  disabled={disabled || active || busy}
                  onClick={() => {
                    setQuestion(message.question);
                    document.getElementById("tutor-question")?.focus();
                  }}
                >
                  {m.retry}
                </Button>
              )}
              {message.status === "complete" && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {m.reportHelp}
                  </p>
                  <Button
                    variant="outline"
                    disabled={disabled || busy || message.reported}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await sendRequest(`${base}/report`, {
                          messageId: message.id,
                        });
                        await refresh();
                      } catch (error) {
                        setError(
                          error instanceof Error ? error.message : m.error,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {message.reported ? m.reported : m.report}
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
        ))}
      </section>
      {data.messages.length > 0 && (
        <Button
          variant="outline"
          disabled={disabled || busy || active}
          onClick={async () => {
            if (!window.confirm(m.deleteConfirm)) return;
            setBusy(true);
            try {
              await sendRequest(base, undefined, "DELETE");
              await refresh();
            } catch (error) {
              setError(error instanceof Error ? error.message : m.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {m.deleteHistory}
        </Button>
      )}
    </div>
  );
}
