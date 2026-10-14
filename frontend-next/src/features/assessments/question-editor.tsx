"use client";
import { useState } from "react";
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
import { questionTypes, type QuestionInput } from "./schema";
import { assessmentMessages as m } from "@/lib/assessment-messages";
export function newQuestion(
  type: QuestionInput["type"] = "mcq",
  previous?: QuestionInput,
): QuestionInput {
  return {
    id: previous?.id ?? `question_${crypto.randomUUID().replaceAll("-", "")}`,
    type,
    prompt: previous?.prompt ?? "",
    conceptIds: previous?.conceptIds ?? [],
    difficulty: previous?.difficulty ?? "medium",
    marks: previous?.marks ?? 1,
    options: ["mcq", "multi_select", "ordering", "matching"].includes(type)
      ? [
          { id: "option_a", text: "Option A" },
          { id: "option_b", text: "Option B" },
        ]
      : [],
    matchPrompts:
      type === "matching"
        ? [
            { id: "prompt_a", text: "Prompt A" },
            { id: "prompt_b", text: "Prompt B" },
          ]
        : [],
    answerIds:
      type === "ordering" || type === "matching"
        ? ["option_a", "option_b"]
        : type === "mcq" || type === "multi_select"
          ? ["option_a"]
          : [],
    numericAnswer: type === "numerical" ? 0 : null,
    tolerance: 0,
    rubric: "",
    explanation: "",
    hint: "",
  };
}
function OptionFields({
  q,
  update,
}: {
  q: QuestionInput;
  update: (q: QuestionInput) => void;
}) {
  const [options, setOptions] = useState(
    q.options.map((o) => `${o.id} | ${o.text}`).join("\n"),
  );
  const [prompts, setPrompts] = useState(
    q.matchPrompts.map((o) => `${o.id} | ${o.text}`).join("\n"),
  );
  const [answers, setAnswers] = useState(q.answerIds.join(", "));
  const parse = (text: string) =>
    text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const [id, ...rest] = line.split("|");
        return { id: id.trim(), text: rest.join("|").trim() };
      });
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`options-${q.id}`}>{m.options}</FieldLabel>
        <Textarea
          id={`options-${q.id}`}
          value={options}
          maxLength={10000}
          onChange={(e) => {
            setOptions(e.target.value);
            update({ ...q, options: parse(e.target.value) });
          }}
        />
      </Field>
      {q.type === "matching" && (
        <Field>
          <FieldLabel htmlFor={`match-${q.id}`}>{m.matchingPrompts}</FieldLabel>
          <Textarea
            id={`match-${q.id}`}
            value={prompts}
            maxLength={10000}
            onChange={(e) => {
              setPrompts(e.target.value);
              update({ ...q, matchPrompts: parse(e.target.value) });
            }}
          />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor={`answers-${q.id}`}>{m.answerIds}</FieldLabel>
        <Input
          id={`answers-${q.id}`}
          value={answers}
          onChange={(e) => {
            setAnswers(e.target.value);
            update({
              ...q,
              answerIds: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
        />
      </Field>
    </>
  );
}
export function QuestionEditor({
  question: q,
  index,
  count,
  concepts,
  update,
  move,
  remove,
}: {
  question: QuestionInput;
  index: number;
  count: number;
  concepts: { id: string; title: string }[];
  update: (q: QuestionInput) => void;
  move: (delta: number) => void;
  remove: () => void;
}) {
  return (
    <FieldSet className="min-w-0 rounded-lg border p-4">
      <FieldLegend>
        {m.questions} {index + 1}
      </FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`type-${q.id}`}>{m.questionType}</FieldLabel>
          <select
            id={`type-${q.id}`}
            className="h-10 rounded-lg border bg-background px-3"
            value={q.type}
            onChange={(e) =>
              update(newQuestion(e.target.value as QuestionInput["type"], q))
            }
          >
            {questionTypes.map((type) => (
              <option key={type} value={type}>
                {m[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`prompt-${q.id}`}>{m.prompt}</FieldLabel>
          <Textarea
            id={`prompt-${q.id}`}
            rows={3}
            value={q.prompt}
            maxLength={4000}
            onChange={(e) => update({ ...q, prompt: e.target.value })}
          />
        </Field>
        <FieldSet>
          <FieldLegend variant="label">{m.concepts}</FieldLegend>
          <div className="grid max-h-40 gap-2 overflow-auto sm:grid-cols-2">
            {concepts.map((concept) => (
              <label
                key={concept.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={q.conceptIds.includes(concept.id)}
                  onChange={(e) =>
                    update({
                      ...q,
                      conceptIds: e.target.checked
                        ? [...q.conceptIds, concept.id]
                        : q.conceptIds.filter((id) => id !== concept.id),
                    })
                  }
                />
                {concept.title}
              </label>
            ))}
          </div>
        </FieldSet>
        <Field>
          <FieldLabel htmlFor={`difficulty-${q.id}`}>{m.difficulty}</FieldLabel>
          <select
            id={`difficulty-${q.id}`}
            className="h-10 rounded-lg border bg-background px-3"
            value={q.difficulty}
            onChange={(e) =>
              update({
                ...q,
                difficulty: e.target.value as QuestionInput["difficulty"],
              })
            }
          >
            {(["easy", "medium", "hard"] as const).map((d) => (
              <option key={d} value={d}>
                {m[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`marks-${q.id}`}>{m.marks}</FieldLabel>
          <Input
            id={`marks-${q.id}`}
            type="number"
            min={1}
            max={100}
            value={q.marks}
            onChange={(e) => update({ ...q, marks: Number(e.target.value) })}
          />
        </Field>
        {["mcq", "multi_select", "ordering", "matching"].includes(q.type) && (
          <OptionFields key={`${q.id}-${q.type}`} q={q} update={update} />
        )}
        {q.type === "numerical" && (
          <>
            <Field>
              <FieldLabel htmlFor={`number-${q.id}`}>
                {m.numericAnswer}
              </FieldLabel>
              <Input
                id={`number-${q.id}`}
                type="number"
                step="any"
                value={q.numericAnswer ?? ""}
                onChange={(e) =>
                  update({
                    ...q,
                    numericAnswer:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`tolerance-${q.id}`}>
                {m.tolerance}
              </FieldLabel>
              <Input
                id={`tolerance-${q.id}`}
                type="number"
                min={0}
                step="any"
                value={q.tolerance}
                onChange={(e) =>
                  update({ ...q, tolerance: Number(e.target.value) })
                }
              />
            </Field>
          </>
        )}
        {["short_answer", "explanation", "coding"].includes(q.type) && (
          <Field>
            <FieldLabel htmlFor={`rubric-${q.id}`}>{m.rubric}</FieldLabel>
            <Textarea
              id={`rubric-${q.id}`}
              maxLength={4000}
              value={q.rubric}
              onChange={(e) => update({ ...q, rubric: e.target.value })}
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`explanation-${q.id}`}>
            {m.explanationLabel}
          </FieldLabel>
          <Textarea
            id={`explanation-${q.id}`}
            maxLength={4000}
            value={q.explanation}
            onChange={(e) => update({ ...q, explanation: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`hint-${q.id}`}>{m.hintLabel}</FieldLabel>
          <Textarea
            id={`hint-${q.id}`}
            maxLength={2000}
            value={q.hint}
            onChange={(e) => update({ ...q, hint: e.target.value })}
          />
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          {m.up}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={index === count - 1}
          onClick={() => move(1)}
        >
          {m.down}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={remove}>
          {m.remove}
        </Button>
      </div>
    </FieldSet>
  );
}
