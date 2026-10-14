"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-error";
import { sendRequest } from "@/lib/request";
import { messages as m } from "@/lib/messages";
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    setPending(true);
    setError(null);
    try {
      await sendRequest("/api/auth/sign-out", {});
      router.push("/login");
      router.refresh();
    } catch {
      setError(m.logoutError);
      setPending(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={logout} disabled={pending}>
        {pending ? m.working : m.logout}
      </Button>
      <FormError message={error} />
    </div>
  );
}
