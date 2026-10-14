"use client";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import type { PublicQuestion, QuestionResponse } from "./schema";
import { assessmentMessages as m } from "@/lib/assessment-messages";
export function QuestionInputControl({
  question: q,
  value,
  onChange,
  disabled = false,
}: {
  question: PublicQuestion;
  value: QuestionResponse;
  onChange: (value: QuestionResponse) => void;
  disabled?: boolean;
}) {
  const id = useId();
  if (q.type === "mcq" || q.type === "multi_select")
    return (
      <FieldSet disabled={disabled}>
        <FieldLegend variant="label">{m.response}</FieldLegend>
        {q.options.map((option) => (
          <label
            key={option.id}
            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
          >
            <input
              className="mt-1"
              type={q.type === "mcq" ? "radio" : "checkbox"}
              name={id}
              checked={
                q.type === "mcq"
                  ? value === option.id
                  : Array.isArray(value) && value.includes(option.id)
              }
              onChange={(e) =>
                onChange(
                  q.type === "mcq"
                    ? option.id
                    : e.target.checked
                      ? [...(Array.isArray(value) ? value : []), option.id]
                      : (Array.isArray(value) ? value : []).filter(
                          (v) => v !== option.id,
                        ),
                )
              }
            />
            <span className="whitespace-pre-wrap break-words">
              {option.text}
            </span>
          </label>
        ))}
      </FieldSet>
    );
  if (q.type === "ordering" || q.type === "matching") {
    const rows =
      q.type === "matching"
        ? q.matchPrompts
        : q.options.map((_, index) => ({
            id: `position_${index}`,
            text: `${m.position} ${index + 1}`,
          }));
    const values = Array.isArray(value) ? value : [];
    return (
      <FieldSet disabled={disabled}>
        <FieldLegend variant="label">{m.response}</FieldLegend>
        {rows.map((row, index) => (
          <Field key={row.id}>
            <FieldLabel htmlFor={`${id}-${index}`}>{row.text}</FieldLabel>
            <select
              id={`${id}-${index}`}
              className="h-10 w-full rounded-lg border bg-background px-3"
              value={values[index] ?? ""}
              onChange={(e) => {
                const next = rows.map((_, i) => values[i] ?? "");
                next[index] = e.target.value;
                onChange(next.every((v) => !v) ? [] : next);
              }}
            >
              <option value="">{m.choose}</option>
              {q.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.text}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </FieldSet>
    );
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{m.response}</FieldLabel>
      {q.type === "numerical" ? (
        <Input
          id={id}
          type="number"
          step="any"
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Textarea
          id={id}
          disabled={disabled}
          rows={q.type === "coding" ? 8 : 4}
          maxLength={10000}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
