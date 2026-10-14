"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AttemptView } from "@/server/attempts";
import type { QuestionResponse } from "./schema";
import { QuestionInputControl } from "./question-input";
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
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/form-error";
import { sendRequest } from "@/lib/request";
import { assessmentMessages as m } from "@/lib/assessment-messages";
import { messages } from "@/lib/messages";
function TeacherReview({
  base,
  question,
  disabled,
}: {
  base: string;
  question: AttemptView["questions"][number];
  disabled: boolean;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState(question.marksAwarded ?? 0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await sendRequest(`${base}/review`, {
            questionId: question.id,
            marks,
            feedback,
          });
          setNotice(m.reviewed);
          router.refresh();
        } catch (error) {
          setError(
            error instanceof Error ? error.message : messages.serverError,
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`grade-${question.id}`}>{m.awarded}</FieldLabel>
          <Input
            id={`grade-${question.id}`}
            disabled={disabled || busy}
            type="number"
            min={0}
            max={question.marks}
            step="0.01"
            required
            value={marks}
            onChange={(e) => setMarks(Number(e.target.value))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`feedback-${question.id}`}>
            {m.feedback}
          </FieldLabel>
          <Textarea
            id={`feedback-${question.id}`}
            disabled={disabled || busy}
            required
            maxLength={4000}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={disabled || busy}>
        {m.reviewSave}
      </Button>
      <FormError message={error} />
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </form>
  );
}
export function AttemptPlayer({
  attempt,
  teacher,
  disabled,
  classroomId,
}: {
  attempt: AttemptView;
  teacher: boolean;
  disabled: boolean;
  classroomId: string;
}) {
  const router = useRouter();
  const base = `/api/classrooms/${classroomId}/attempts/${attempt.id}`;
  return (
    <AttemptContent
      attempt={attempt}
      teacher={teacher}
      disabled={disabled}
      base={base}
      refresh={() => router.refresh()}
    />
  );
}
export function AttemptContent({
  attempt,
  teacher,
  disabled,
  base,
  refresh,
}: {
  attempt: AttemptView;
  teacher: boolean;
  disabled: boolean;
  base: string;
  refresh: () => void;
}) {
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>(
    () => Object.fromEntries(attempt.questions.map((q) => [q.id, q.response])),
  );
  const [hints, setHints] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      attempt.questions.filter((q) => q.hint).map((q) => [q.id, q.hint!]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const submitted = !!attempt.submittedAt;
  async function save(submit: boolean) {
    setBusy(true);
    setError("");
    try {
      await sendRequest(
        base,
        {
          responses: attempt.questions.map((q) => ({
            questionId: q.id,
            response: responses[q.id] ?? "",
          })),
        },
        submit ? "POST" : "PATCH",
      );
      setNotice(submit ? "" : m.savedAnswers);
      if (submit) refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.serverError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>
              {submitted ? m.result : m.attempt} {attempt.number}
            </h2>
          </CardTitle>
          <CardDescription>
            {teacher ? attempt.studentName : attempt.instructions}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {submitted ? (
            <>
              <p className="text-2xl font-semibold">
                {m.score}: {attempt.score.toFixed(2)} / {attempt.maximumScore}
              </p>
              <Badge variant="secondary">
                {attempt.pendingReview ? m.pending : m.complete}
              </Badge>
              {attempt.pendingReview && (
                <p className="text-sm text-muted-foreground">{m.pendingHelp}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{m.submitHelp}</p>
              <p className="text-sm text-muted-foreground">{m.hintsHelp}</p>
            </>
          )}
          <p className="text-sm text-muted-foreground">{m.noAiStudent}</p>
        </CardContent>
      </Card>
      {attempt.questions.map((q, index) => (
        <Card key={q.id}>
          <CardHeader>
            <CardTitle>
              <h2 className="whitespace-pre-wrap break-words">
                {index + 1}. {q.prompt}
              </h2>
            </CardTitle>
            <CardDescription>
              {m[q.type]} · {m[q.difficulty]} · {q.marks}{" "}
              {m.marks.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-4">
            {q.rubric && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {m.rubric}: {q.rubric}
              </p>
            )}
            <QuestionInputControl
              question={q}
              value={responses[q.id] ?? ""}
              onChange={(value) =>
                setResponses((previous) => ({ ...previous, [q.id]: value }))
              }
              disabled={submitted || teacher || disabled || busy}
            />
            {hints[q.id] && (
              <p className="whitespace-pre-wrap text-sm">
                {m.hintUsed}: {hints[q.id]}
              </p>
            )}
            {!submitted && !teacher && q.hasHint && !hints[q.id] && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || disabled}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const result = await sendRequest<{ hint: string }>(
                      `${base}/hint`,
                      { questionId: q.id },
                    );
                    setHints((previous) => ({
                      ...previous,
                      [q.id]: result.hint,
                    }));
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : messages.serverError,
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {m.hint}
              </Button>
            )}
            {submitted && (
              <>
                <p className="text-sm font-medium">
                  {q.needsReview
                    ? m.pending
                    : `${q.marksAwarded ?? 0} / ${q.marks}`}
                </p>
                <p className="whitespace-pre-wrap text-sm">{q.feedback}</p>
                {q.solution ? (
                  <details>
                    <summary className="cursor-pointer font-medium">
                      {m.solutions}
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {q.type === "numerical"
                        ? `${q.solution.numericAnswer} ± ${q.solution.tolerance}`
                        : q.solution.answerIds
                            .map(
                              (id, i) =>
                                `${q.type === "matching" ? `${q.matchPrompts[i]?.text}: ` : ""}${q.options.find((o) => o.id === id)?.text ?? id}`,
                            )
                            .join(", ")}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {q.solution.explanation}
                    </p>
                  </details>
                ) : (
                  <p className="text-sm text-muted-foreground">{m.withheld}</p>
                )}
              </>
            )}
            {teacher && submitted && (
              <TeacherReview base={base} question={q} disabled={disabled} />
            )}
          </CardContent>
        </Card>
      ))}
      <FormError message={error} />
      {notice && <p role="status">{notice}</p>}
      {!submitted && !teacher && (
        <Card>
          <CardFooter className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={busy || disabled}
              onClick={() => save(true)}
            >
              {busy ? m.submitting : m.submit}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || disabled}
              onClick={() => save(false)}
            >
              {m.saveAnswers}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
