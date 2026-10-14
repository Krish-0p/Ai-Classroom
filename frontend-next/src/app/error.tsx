"use client";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { messages as m } from "@/lib/messages";
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Alert role="alert">
      <AlertTitle>{m.errorTitle}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-4">
        <p>{m.errorDescription}</p>
        <Button onClick={retry}>{m.retry}</Button>
      </AlertDescription>
    </Alert>
  );
}
