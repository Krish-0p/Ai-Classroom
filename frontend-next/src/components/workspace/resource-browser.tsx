"use client";
import { useId, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { workspaceMessages as w } from "@/lib/workspace-messages";
import { ListPagination } from "./list-pagination";

export function ResourceBrowser({
  items,
  teacher = false,
}: {
  items: {
    id: string;
    title: string;
    search?: string;
    status?: string;
    content: ReactNode;
  }[];
  teacher?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const visible = items.filter(
    (item) =>
      (status === "all" || item.status === status) &&
      `${item.title} ${item.search ?? ""}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const filters = [
    ["all", w.all],
    ["published", w.publishedStatus],
    ["draft", w.draftStatus],
    ["review", w.reviewStatus],
    ["archived", w.archivedStatus],
  ].filter(
    ([value]) => value === "all" || items.some((item) => item.status === value),
  );
  const pages = Math.ceil(visible.length / 12);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  return (
    <div className="resource-browser">
      <div className="resource-browser-toolbar">
        <Field>
          <FieldLabel htmlFor={id} className="sr-only">
            {w.searchLabel}
          </FieldLabel>
          <Input
            id={id}
            type="search"
            placeholder={w.search}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </Field>
        <p className="resource-count" role="status">
          {w.showing} {visible.length} {w.of} {items.length}
        </p>
      </div>
      {teacher && (
        <Tabs
          value={status}
          onValueChange={(value) => {
            setStatus(String(value));
            setPage(0);
          }}
        >
          <TabsList
            className="max-w-full overflow-x-auto"
            aria-label={w.searchLabel}
          >
            {filters.map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {visible.length ? (
        <ol className="learning-resource-list">
          {visible
            .slice(currentPage * 12, (currentPage + 1) * 12)
            .map((item) => item.content)}
        </ol>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{w.noResults}</EmptyTitle>
            <EmptyDescription>{w.noResultsHelp}</EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
          >
            {w.clear}
          </Button>
        </Empty>
      )}
      <ListPagination page={currentPage} pages={pages} onChange={setPage} />
    </div>
  );
}
