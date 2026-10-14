"use client";
import { useEffect, useState } from "react";
import type { readIndexes } from "@/server/rag-index";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { FormError } from "@/components/form-error";
import { sendRequest } from "@/lib/request";
import { tutorMessages as m } from "@/lib/tutor-messages";
type Indexes = Awaited<ReturnType<typeof readIndexes>>;
export function SourceIndexer({
  classroomId,
  initial,
  disabled,
}: {
  classroomId: string;
  initial: Indexes;
  disabled: boolean;
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = ["queued", "generating"].includes(data.job?.status ?? "");
  const base = `/api/classrooms/${classroomId}/tutor/index`;
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const interval = setInterval(async () => {
      try {
        const next = await sendRequest<Indexes>(base, undefined, "GET");
        if (!stopped) setData(next);
      } catch (error) {
        if (!stopped)
          setError(error instanceof Error ? error.message : m.error);
      }
    }, 2500);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [active, base]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{m.indexTitle}</h2>
        </CardTitle>
        <CardDescription>{m.indexHelp}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!data.sources.length && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{m.noSources}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
        <ul className="flex flex-col gap-3">
          {data.sources.map((source) => (
            <li
              key={source.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="break-all">{source.filename}</span>
              <Badge variant={source.ready ? "secondary" : "outline"}>
                {source.ready ? m.ready : m.notIndexed}
              </Badge>
              <Button
                variant="outline"
                disabled={disabled || busy || active || source.ready}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await sendRequest(base, { sourceId: source.id });
                    setData(await sendRequest<Indexes>(base, undefined, "GET"));
                  } catch (error) {
                    setError(error instanceof Error ? error.message : m.error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy || active ? m.indexing : m.index}
              </Button>
            </li>
          ))}
        </ul>
        {data.job && (
          <p role="status">
            {m[
              data.job.status as "queued" | "generating" | "complete" | "failed"
            ] ?? data.job.status}{" "}
            · {data.job.progress}%
          </p>
        )}
        <FormError message={error || data.job?.error || ""} />
      </CardContent>
    </Card>
  );
}
