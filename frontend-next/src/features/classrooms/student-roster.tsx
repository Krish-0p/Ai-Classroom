"use client";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { messages as m } from "@/lib/messages";
import { workspaceMessages as w } from "@/lib/workspace-messages";
import { ListPagination } from "@/components/workspace/list-pagination";

export function StudentRoster({
  students,
}: {
  students: { id: string; name: string; joinedAt: string }[];
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const visible = students.filter((student) =>
    student.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const pages = Math.ceil(visible.length / 15);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{m.enrolledStudents}</h2>
        </CardTitle>
        <CardDescription>{w.rosterHelp}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="resource-browser-toolbar">
          <Field>
            <FieldLabel htmlFor={id} className="sr-only">
              {w.searchStudents}
            </FieldLabel>
            <Input
              id={id}
              type="search"
              placeholder={w.searchStudents}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </Field>
          <p className="resource-count" role="status">
            {visible.length} {w.of} {students.length}
          </p>
        </div>
        {!visible.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {students.length ? w.noResults : m.noStudents}
              </EmptyTitle>
              <EmptyDescription>
                {students.length ? w.noResultsHelp : m.noStudentsHelp}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="roster-table">
              <caption className="sr-only">{m.enrolledStudents}</caption>
              <thead>
                <tr>
                  <th scope="col">{w.student}</th>
                  <th scope="col">{w.joined}</th>
                  <th scope="col">{w.enrollment}</th>
                </tr>
              </thead>
              <tbody>
                {visible
                  .slice(currentPage * 15, (currentPage + 1) * 15)
                  .map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="roster-student">
                          <span className="roster-avatar" aria-hidden="true">
                            {student.name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")
                              .toLocaleUpperCase()}
                          </span>
                          <span>{student.name}</span>
                        </div>
                      </td>
                      <td>{student.joinedAt}</td>
                      <td>
                        <Badge variant="secondary">{w.enrolled}</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <ListPagination page={currentPage} pages={pages} onChange={setPage} />
      </CardContent>
    </Card>
  );
}
