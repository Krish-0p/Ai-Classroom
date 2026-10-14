import Link from "next/link";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import { messages as m } from "@/lib/messages";
export default function NotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{m.missingTitle}</EmptyTitle>
        <EmptyDescription>{m.missingDescription}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline" })}
        >
          {m.back}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
