"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { emailSchema, passwordSchema } from "@/features/auth/schema";
import { sendRequest } from "@/lib/request";
import { messages as m } from "@/lib/messages";

export function RequestPasswordResetForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setValidation("");
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { setValidation(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      await sendRequest("/api/auth/request-password-reset", { email: parsed.data, redirectTo: `${window.location.origin}/reset-password` });
      setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : m.serverError); }
    finally { setPending(false); }
  }
  return <Card className="password-recovery-card"><CardHeader><CardTitle><h1>{m.forgotPasswordTitle}</h1></CardTitle><CardDescription>{m.forgotPasswordDescription}</CardDescription></CardHeader><CardContent>
    {sent ? <p className="password-recovery-success" role="status">{m.resetEmailSent}</p> : <form onSubmit={submit} noValidate className="flex flex-col gap-5" aria-busy={pending}><FieldGroup><Field data-invalid={!!validation}><FieldLabel htmlFor="reset-email">{m.email}</FieldLabel><Input id="reset-email" type="email" autoComplete="email" maxLength={254} required value={email} disabled={pending} aria-invalid={!!validation} aria-describedby="reset-email-error" onChange={(event) => setEmail(event.target.value)} /><FieldError id="reset-email-error">{validation}</FieldError></Field></FieldGroup><FormError message={error} /><Button type="submit" disabled={pending}>{pending ? m.working : "Send reset link"}</Button></form>}
  </CardContent><CardFooter><Link className="auth-forgot-link" href="/login">{m.backToLogin}</Link></CardFooter></Card>;
}

export function ResetPasswordForm({ token, invalidLink = false }: { token?: string; invalidLink?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setValidation("");
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) { setValidation(parsed.error.issues[0].message); return; }
    if (password !== confirm) { setValidation(m.passwordMismatch); return; }
    if (!token) { setError(m.resetInvalid); return; }
    setPending(true);
    try {
      await sendRequest("/api/auth/reset-password", { token, newPassword: parsed.data });
      setSuccess(true);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : m.resetInvalid); }
    finally { setPending(false); }
  }
  if (success) return <Card className="password-recovery-card"><CardHeader><CardTitle><h1>{m.resetPassword}</h1></CardTitle></CardHeader><CardContent><p className="password-recovery-success" role="status">{m.resetSuccess}</p></CardContent><CardFooter><Link className="auth-forgot-link" href="/login">{m.backToLogin}</Link></CardFooter></Card>;
  if (!token || invalidLink) return <Card className="password-recovery-card"><CardHeader><CardTitle><h1>{m.resetPassword}</h1></CardTitle><CardDescription>{m.resetInvalid}</CardDescription></CardHeader><CardFooter><Link className="auth-forgot-link" href="/forgot-password">{m.requestNewLink}</Link></CardFooter></Card>;
  return <Card className="password-recovery-card"><CardHeader><CardTitle><h1>{m.resetPassword}</h1></CardTitle><CardDescription>Choose a new password of at least 12 characters.</CardDescription></CardHeader><CardContent><form onSubmit={submit} noValidate className="flex flex-col gap-5" aria-busy={pending}><FieldGroup><Field data-invalid={!!validation}><FieldLabel htmlFor="new-password">{m.newPassword}</FieldLabel><Input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} disabled={pending} aria-invalid={!!validation} onChange={(event) => setPassword(event.target.value)} /></Field><Field><FieldLabel htmlFor="confirm-password">{m.confirmPassword}</FieldLabel><Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} disabled={pending} onChange={(event) => setConfirm(event.target.value)} /></Field></FieldGroup><p className="text-sm text-destructive" role={validation ? "alert" : undefined}>{validation}</p><FormError message={error} /><Button type="submit" disabled={pending}>{pending ? m.working : m.resetPassword}</Button></form></CardContent><CardFooter><Link className="auth-forgot-link" href="/login">{m.backToLogin}</Link></CardFooter></Card>;
}
