"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workspaceMessages as w } from "@/lib/workspace-messages";

export function ListPagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="workspace-sequence-actions" aria-label={w.page}>
      <Button
        variant="outline"
        size="sm"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        <ArrowLeft data-icon="inline-start" />
        {w.previous}
      </Button>
      <p className="resource-count" role="status">
        {w.page} {page + 1} {w.of} {pages}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={page + 1 >= pages}
        onClick={() => onChange(page + 1)}
      >
        {w.next}
        <ArrowRight data-icon="inline-end" />
      </Button>
    </nav>
  );
}
