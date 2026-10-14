"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { FormError } from "@/components/form-error";
import { sendRequest } from "@/lib/request";
import { messages as m } from "@/lib/messages";
export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setPending(true);
    setError(null);
    try {
      await sendRequest(`/api/classrooms/${id}`, undefined, "DELETE");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : m.serverError);
      setPending(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      {confirm ? (
        <Alert variant="destructive">
          <AlertTitle>{m.delete}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>{m.deleteWarning}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={remove} disabled={pending}>
                {pending ? m.working : m.confirmDelete}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirm(false)}
                disabled={pending}
              >
                {m.cancel}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Button variant="destructive" onClick={() => setConfirm(true)}>
          {m.delete}
        </Button>
      )}
      <FormError message={error} />
    </div>
  );
}
