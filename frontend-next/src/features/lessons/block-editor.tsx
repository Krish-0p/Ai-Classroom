"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import type { LessonBlockInput } from "./schema";
import { lessonMessages as m } from "@/lib/lesson-messages";
export const blockTypes = [
  "text",
  "callout",
  "example",
  "code",
  "diagram",
  "checkpoint",
] as const;
export function newLessonBlock(
  type: LessonBlockInput["type"],
  previous?: LessonBlockInput,
): LessonBlockInput {
  const base = {
    id: previous?.id ?? `block_${crypto.randomUUID().replaceAll("-", "")}`,
    title: previous?.title ?? m[type],
    locked: previous?.locked ?? false,
  };
  if (type === "checkpoint") return { ...base, type, prompt: "", answer: "" };
  if (type === "code")
    return { ...base, type, body: "", language: "text", code: "" };
  if (type === "diagram")
    return {
      ...base,
      type,
      body: "",
      nodes: [{ id: "start", label: "Start" }],
      edges: [],
    };
  return { ...base, type, body: "" };
}
type Props = {
  block: LessonBlockInput;
  index: number;
  count: number;
  update: (block: LessonBlockInput) => void;
  move: (delta: number) => void;
  remove: () => void;
};
export function BlockEditor({
  block,
  index,
  count,
  update,
  move,
  remove,
}: Props) {
  function patch(values: Partial<LessonBlockInput>) {
    update({ ...block, ...values } as LessonBlockInput);
  }
  return (
    <FieldSet className="min-w-0 rounded-lg border p-4">
      <FieldLegend>
        {m.blocks} {index + 1}
      </FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`type-${block.id}`}>{m.blockType}</FieldLabel>
          <select
            id={`type-${block.id}`}
            className="h-10 w-full rounded-lg border bg-background px-3"
            value={block.type}
            onChange={(event) =>
              update(
                newLessonBlock(
                  event.target.value as LessonBlockInput["type"],
                  block,
                ),
              )
            }
          >
            {blockTypes.map((type) => (
              <option key={type} value={type}>
                {m[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`title-${block.id}`}>{m.blockTitle}</FieldLabel>
          <Input
            id={`title-${block.id}`}
            value={block.title}
            maxLength={160}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
        {block.type !== "checkpoint" && (
          <Field>
            <FieldLabel htmlFor={`body-${block.id}`}>{m.body}</FieldLabel>
            <Textarea
              id={`body-${block.id}`}
              rows={5}
              value={block.body}
              maxLength={10000}
              onChange={(event) => patch({ body: event.target.value })}
            />
          </Field>
        )}
        {block.type === "code" && (
          <>
            <Field>
              <FieldLabel htmlFor={`language-${block.id}`}>
                {m.codeLanguage}
              </FieldLabel>
              <Input
                id={`language-${block.id}`}
                value={block.language}
                maxLength={40}
                onChange={(event) => patch({ language: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`code-${block.id}`}>{m.codeText}</FieldLabel>
              <Textarea
                id={`code-${block.id}`}
                rows={8}
                value={block.code}
                maxLength={10000}
                onChange={(event) => patch({ code: event.target.value })}
              />
            </Field>
          </>
        )}
        {block.type === "checkpoint" && (
          <>
            <Field>
              <FieldLabel htmlFor={`prompt-${block.id}`}>{m.prompt}</FieldLabel>
              <Textarea
                id={`prompt-${block.id}`}
                value={block.prompt}
                maxLength={10000}
                onChange={(event) => patch({ prompt: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`answer-${block.id}`}>{m.answer}</FieldLabel>
              <Textarea
                id={`answer-${block.id}`}
                value={block.answer}
                maxLength={10000}
                onChange={(event) => patch({ answer: event.target.value })}
              />
            </Field>
          </>
        )}
        {block.type === "diagram" && (
          <DiagramFields key={block.id} block={block} update={update} />
        )}
      </FieldGroup>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={block.locked}
          onChange={(event) => patch({ locked: event.target.checked })}
        />
        {m.lock}
      </label>
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

function DiagramFields({
  block,
  update,
}: {
  block: Extract<LessonBlockInput, { type: "diagram" }>;
  update: (block: LessonBlockInput) => void;
}) {
  const [nodes, setNodes] = useState(
    block.nodes.map((node) => `${node.id} | ${node.label}`).join("\n"),
  );
  const [edges, setEdges] = useState(
    block.edges.map((edge) => `${edge.from} | ${edge.to}`).join("\n"),
  );
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`nodes-${block.id}`}>{m.nodes}</FieldLabel>
        <Textarea
          id={`nodes-${block.id}`}
          value={nodes}
          maxLength={10000}
          onChange={(event) => {
            const value = event.target.value;
            setNodes(value);
            update({
              ...block,
              nodes: value
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => {
                  const [id, ...label] = line.split("|");
                  return { id: id.trim(), label: label.join("|").trim() };
                }),
            });
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`edges-${block.id}`}>{m.edges}</FieldLabel>
        <Textarea
          id={`edges-${block.id}`}
          value={edges}
          maxLength={10000}
          onChange={(event) => {
            const value = event.target.value;
            setEdges(value);
            update({
              ...block,
              edges: value
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => {
                  const [from, to = ""] = line.split("|");
                  return { from: from.trim(), to: to.trim() };
                }),
            });
          }}
        />
      </Field>
    </>
  );
}
