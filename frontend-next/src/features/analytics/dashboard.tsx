"use client";
import { useId, useState } from "react";
import Link from "next/link";
import type { AnalyticsView } from "@/server/analytics";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { analyticsMessages as m } from "@/lib/analytics-messages";
import { tutorMessages as tm } from "@/lib/tutor-messages";
import { cn } from "@/lib/utils";
const percentage = (value: number | null) =>
  value === null ? m.notMeasured : `${Math.round(value * 100)}%`;
export function AnalyticsDashboard({
  data,
  classroomId,
}: {
  data: AnalyticsView;
  classroomId: string;
}) {
  const [selected, setSelected] = useState(data.concepts[0]?.id);
  const marker = useId();
  const concept = data.concepts.find((concept) => concept.id === selected);
  const positions = new Map(
    data.concepts.map((concept, index) => [
      concept.id,
      { x: 15 + (index % 3) * 250, y: 20 + Math.floor(index / 3) * 120 },
    ]),
  );
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">{m.description}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [m.enrolled, data.enrolled],
          [m.submissions, data.submissions],
          [m.pending, data.pending],
          [m.completed, data.completed],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle>{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{m.allTime}</p>
      {!data.concepts.length && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{m.missing}</EmptyTitle>
            <EmptyDescription>{m.missingHelp}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {data.concepts.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{m.map}</h2>
              </CardTitle>
              <CardDescription>{m.mapHelp}</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="max-h-[32rem] overflow-auto"
                tabIndex={0}
                role="region"
                aria-label={m.map}
              >
                <svg
                  width="760"
                  height={Math.max(
                    140,
                    Math.ceil(data.concepts.length / 3) * 120,
                  )}
                  aria-label={m.map}
                  role="group"
                >
                  <defs>
                    <marker
                      id={marker}
                      markerWidth="8"
                      markerHeight="8"
                      refX="7"
                      refY="4"
                      orient="auto"
                    >
                      <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
                    </marker>
                  </defs>
                  {data.concepts.flatMap((node) =>
                    node.prerequisiteIds.map((parent) => {
                      const from = positions.get(parent),
                        to = positions.get(node.id);
                      if (!from || !to) return null;
                      return (
                        <path
                          key={`${parent}-${node.id}`}
                          d={`M${from.x + 110} ${from.y + 75} L${to.x + 110} ${to.y}`}
                          stroke="currentColor"
                          opacity="0.4"
                          markerEnd={`url(#${marker})`}
                        />
                      );
                    }),
                  )}
                  {data.concepts.map((node) => {
                    const point = positions.get(node.id)!;
                    const state =
                      node.distribution.reviewNeeded > 0
                        ? "reviewNeeded"
                        : !node.coverage
                          ? "noEvidence"
                          : node.distribution.insufficient === node.coverage
                            ? "insufficient"
                            : node.distribution.secure > 0 &&
                                node.distribution.developing === 0 &&
                                node.distribution.insufficient === 0
                              ? "secure"
                              : "developing";
                    return (
                      <a
                        key={node.id}
                        href="#concept-details"
                        onClick={() => setSelected(node.id)}
                        aria-label={`${node.title}: ${m[state]}`}
                      >
                        <title>
                          {node.title}: {m[state]}
                        </title>
                        <rect
                          x={point.x}
                          y={point.y}
                          width="220"
                          height="75"
                          rx="8"
                          className={cn(
                            "stroke-border",
                            state === "reviewNeeded"
                              ? "fill-destructive/15"
                              : state === "secure"
                                ? "fill-primary/15"
                                : "fill-muted",
                          )}
                          strokeWidth={node.id === selected ? 3 : 1}
                        />
                        <text
                          x={point.x + 10}
                          y={point.y + 27}
                          fill="currentColor"
                          fontSize="13"
                        >
                          {node.title.length > 26
                            ? `${node.title.slice(0, 25)}…`
                            : node.title}
                        </text>
                        <text
                          x={point.x + 10}
                          y={point.y + 51}
                          fill="currentColor"
                          fontSize="12"
                        >
                          {m[state]} · {percentage(node.average)}
                        </text>
                      </a>
                    );
                  })}
                </svg>
              </div>
            </CardContent>
          </Card>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <caption className="p-4 text-left font-medium">
                {m.concepts}
              </caption>
              <thead>
                <tr>
                  {[m.concept, m.average, m.confidence, m.coverage, m.weak].map(
                    (label) => (
                      <th scope="col" className="p-3" key={label}>
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.concepts.map((node) => (
                  <tr className="border-t" key={node.id}>
                    <th scope="row" className="p-3">
                      <Button
                        variant="link"
                        onClick={() => {
                          setSelected(node.id);
                          document
                            .getElementById("concept-details")
                            ?.scrollIntoView();
                        }}
                      >
                        {node.title}
                      </Button>
                    </th>
                    <td className="p-3">{percentage(node.average)}</td>
                    <td className="p-3">{percentage(node.confidence)}</td>
                    <td className="p-3">
                      {node.coverage}/{data.enrolled}
                    </td>
                    <td className="p-3">{node.distribution.reviewNeeded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {concept && (
            <Card id="concept-details">
              <CardHeader>
                <CardTitle>
                  <h2>{concept.title}</h2>
                </CardTitle>
                <CardDescription>{m.details}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="grid gap-4 sm:grid-cols-3">
                  {[
                    [m.evidence, concept.evidenceCount],
                    [m.errorRate, percentage(concept.errorRate)],
                    [m.hintRate, percentage(concept.hintRate)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <h3 className="font-medium">{m.distribution}</h3>
                <ul className="flex flex-wrap gap-3">
                  {Object.entries(concept.distribution).map(
                    ([state, count]) => (
                      <li key={state}>
                        <Badge variant="outline">
                          {m[state as keyof typeof concept.distribution]}:{" "}
                          {count}
                        </Badge>
                      </li>
                    ),
                  )}
                </ul>
                <h3 className="font-medium">{m.prerequisites}</h3>
                <ul className="flex flex-wrap gap-2">
                  {concept.prerequisiteIds.map((id) => (
                    <li key={id}>
                      <Button variant="link" onClick={() => setSelected(id)}>
                        {data.concepts.find((node) => node.id === id)?.title}
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">{m.reviewHelp}</p>
              </CardContent>
              <CardFooter>
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/dashboard/classrooms/${classroomId}/lessons`}
                >
                  {m.reviewLesson}
                </Link>
              </CardFooter>
            </Card>
          )}
        </>
      )}
      <p className="text-sm text-muted-foreground">{m.limited}</p>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{m.attention}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.attention.length ? (
            <p>{m.noAttention}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.attention.map((student, index) => (
                <li key={index}>
                  <span className="font-medium">{student.name}</span>:{" "}
                  {student.concepts.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{m.assessment}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!data.trends.length ? (
            <p>{m.missing}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    m.assessment,
                    m.submissions,
                    m.learners,
                    m.averageScore,
                    m.pending,
                  ].map((label) => (
                    <th className="p-3" scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.trends.map((trend) => (
                  <tr
                    key={`${trend.assessmentId}:${trend.version}`}
                    className="border-t"
                  >
                    <th scope="row" className="p-3">
                      <Link
                        className="underline"
                        href={`/dashboard/classrooms/${classroomId}/assessments/${trend.assessmentId}`}
                      >
                        {trend.title} (v{trend.version})
                      </Link>
                    </th>
                    <td className="p-3">{trend.submissions}</td>
                    <td className="p-3">{trend.students}</td>
                    <td className="p-3">{percentage(trend.averageScore)}</td>
                    <td className="p-3">{trend.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{m.missed}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.missed.length ? (
            <p>{m.missing}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {data.missed.map((question) => (
                <li key={question.key}>
                  <p className="whitespace-pre-wrap break-words font-medium">
                    {question.prompt}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {question.title} · {m.errorRate}:{" "}
                    {percentage(question.errors / question.responses)} ·{" "}
                    {m.responses}: {question.responses}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{m.activity}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.events.length ? (
            <p>{m.missing}</p>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              {data.events.map((event) => (
                <div key={event.type}>
                  <dt>{m[event.type as keyof typeof m] ?? event.type}</dt>
                  <dd>{event.count}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{tm.reports}</h2>
          </CardTitle>
          <CardDescription>{tm.reportHelp}</CardDescription>
        </CardHeader>
        <CardContent>
          {!data.reports.length ? (
            <p>{tm.noReports}</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {data.reports.map((report) => (
                <li key={report.id}>
                  <p className="whitespace-pre-wrap break-words font-medium">
                    {report.question}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words">
                    {report.answer}
                  </p>
                  <details className="mt-2">
                    <summary>{tm.source}</summary>
                    {report.citations.map((c) => (
                      <blockquote key={c.id} className="mt-3 border-l-2 pl-3">
                        <p>
                          {c.filename} · {c.label}
                        </p>
                        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                          {c.text}
                        </p>
                      </blockquote>
                    ))}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
