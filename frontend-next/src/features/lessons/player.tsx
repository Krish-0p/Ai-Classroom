"use client";
import { useState, useId, useRef } from "react";
import type { LessonInput, LessonBlockInput } from "./schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { lessonMessages as m } from "@/lib/lesson-messages";
import {
  useLearningEvents,
  type LessonActivityContext,
} from "@/features/analytics/use-learning-events";
import { FormError } from "@/components/form-error";

function Diagram({
  block,
}: {
  block: Extract<LessonBlockInput, { type: "diagram" }>;
}) {
  const labelId = useId();
  const points = new Map(
    block.nodes.map((node, index) => [
      node.id,
      { x: 20 + (index % 2) * 260, y: 20 + Math.floor(index / 2) * 100 },
    ]),
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="whitespace-pre-wrap break-words">{block.body}</p>
      <div
        className="max-h-96 overflow-auto rounded-lg border p-2"
        tabIndex={0}
        role="region"
        aria-label={block.title}
      >
        <svg
          width="540"
          height={Math.max(120, Math.ceil(block.nodes.length / 2) * 100 + 20)}
          role="img"
          aria-labelledby={labelId}
        >
          <title id={labelId}>{block.title}</title>
          <defs>
            <marker
              id={`${labelId}-arrow`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
            </marker>
          </defs>
          {block.edges.map((edge, index) => {
            const start = points.get(edge.from)!;
            const end = points.get(edge.to)!;
            const horizontal = start.x !== end.x;
            const startX = horizontal
              ? start.x + (end.x > start.x ? 220 : 0)
              : start.x + 110;
            const endX = horizontal
              ? end.x + (end.x > start.x ? 0 : 220)
              : end.x + 110;
            const startY = horizontal
              ? start.y + 30
              : start.y + (end.y > start.y ? 60 : 0);
            const endY = horizontal
              ? end.y + 30
              : end.y + (end.y > start.y ? 0 : 60);
            return (
              <path
                key={index}
                d={`M${startX} ${startY} L${endX} ${endY}`}
                stroke="currentColor"
                opacity="0.5"
                markerEnd={`url(#${labelId}-arrow)`}
              />
            );
          })}
          {block.nodes.map((node) => {
            const point = points.get(node.id)!;
            return (
              <g key={node.id}>
                <title>{node.label}</title>
                <rect
                  x={point.x}
                  y={point.y}
                  width="220"
                  height="60"
                  rx="8"
                  className="fill-card stroke-border"
                />
                <text
                  x={point.x + 10}
                  y={point.y + 34}
                  fill="currentColor"
                  fontSize="13"
                >
                  {node.label.length > 27
                    ? `${node.label.slice(0, 26)}…`
                    : node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div>
        <h3 className="font-medium">{m.diagramDescription}</h3>
        <ul className="mt-2 list-disc pl-5">
          {block.edges.map((edge, index) => (
            <li key={index}>
              {block.nodes.find((node) => node.id === edge.from)?.label} —{" "}
              {block.nodes.find((node) => node.id === edge.to)?.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
function Checkpoint({
  block,
  onAnswer,
}: {
  block: Extract<LessonBlockInput, { type: "checkpoint" }>;
  onAnswer?: () => void;
}) {
  const [response, setResponse] = useState("");
  const [revealed, setRevealed] = useState(false);
  const inputId = useId();
  return (
    <div className="flex flex-col gap-4">
      <p className="whitespace-pre-wrap break-words">{block.prompt}</p>
      <p className="text-sm text-muted-foreground">{m.reflectionHelp}</p>
      <Field>
        <FieldLabel htmlFor={inputId}>{m.response}</FieldLabel>
        <Textarea
          id={inputId}
          value={response}
          maxLength={10000}
          onChange={(event) => setResponse(event.target.value)}
        />
      </Field>
      <Button
        type="button"
        variant="outline"
        disabled={!response.trim()}
        onClick={() => {
          setRevealed(true);
          onAnswer?.();
        }}
      >
        {m.reveal}
      </Button>
      {revealed && (
        <Alert>
          <AlertTitle>{m.answer}</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap break-words">
            {block.answer}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
function BlockContent({
  block,
  onAnswer,
}: {
  block: LessonBlockInput;
  onAnswer?: () => void;
}) {
  if (block.type === "checkpoint")
    return <Checkpoint block={block} onAnswer={onAnswer} />;
  if (block.type === "diagram") return <Diagram block={block} />;
  if (block.type === "callout")
    return (
      <Alert>
        <AlertDescription className="whitespace-pre-wrap break-words">
          {block.body}
        </AlertDescription>
      </Alert>
    );
  return (
    <div className="flex flex-col gap-4">
      <p className="whitespace-pre-wrap break-words leading-relaxed">
        {block.body}
      </p>
      {block.type === "code" && (
        <>
          <p className="text-sm text-muted-foreground">
            {block.language} · {m.codeText}
          </p>
          <pre className="overflow-auto rounded-lg border bg-muted p-4 text-sm">
            <code>{block.code}</code>
          </pre>
        </>
      )}
    </div>
  );
}
export function LessonPlayer({
  lesson,
  activity,
}: {
  lesson: LessonInput;
  activity?: LessonActivityContext;
}) {
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const block = lesson.blocks[index];
  const events = useLearningEvents(
    activity,
    block?.id,
    index === lesson.blocks.length && lesson.blocks.length > 0,
  );
  function go(next: number) {
    setIndex(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  if (!lesson.blocks.length)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{m.empty}</EmptyTitle>
          <EmptyDescription>{m.emptyPublish}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  if (!block)
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 ref={heading} tabIndex={-1}>
              {m.finished}
            </h2>
          </CardTitle>
          <CardDescription>{m.finishedHelp}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormError message={events.error} />
        </CardContent>
        <CardFooter>
          <Button type="button" onClick={() => go(0)}>
            {m.restart}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => go(lesson.blocks.length - 1)}
          >
            {m.previous}
          </Button>
        </CardFooter>
      </Card>
    );
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {m.blocks}: {index + 1} / {lesson.blocks.length} · {m[block.type]}
        </CardDescription>
        <CardTitle>
          <h2 ref={heading} tabIndex={-1} className="break-words">
            {block.title}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-5">
        <progress
          aria-label={m.blocks}
          max={lesson.blocks.length}
          value={index + 1}
          className="w-full"
        />
        <BlockContent
          key={block.id}
          block={block}
          onAnswer={events.checkpoint}
        />
        <FormError message={events.error} />
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          {m.previous}
        </Button>
        <Button type="button" onClick={() => go(index + 1)}>
          {index === lesson.blocks.length - 1 ? m.finish : m.next}
        </Button>
      </CardFooter>
    </Card>
  );
}
