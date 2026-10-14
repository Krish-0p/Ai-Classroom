"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { loginSchema, registrationSchema } from "@/features/auth/schema";
import { sendRequest } from "@/lib/request";
import { messages as m } from "@/lib/messages";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrors({});
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (register ? registrationSchema : loginSchema).safeParse(
      values,
    );
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setPending(true);
    try {
      await sendRequest(
        `/api/auth/${register ? "sign-up" : "sign-in"}/email`,
        parsed.data,
      );
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : m.serverError);
      setPending(false);
    }
  }
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>
          <h1>{register ? m.register : m.login}</h1>
        </CardTitle>
        <CardDescription>
          {register ? m.registerDescription : m.authDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={submit}
          noValidate
          aria-busy={pending}
          className="flex flex-col gap-6"
        >
          <FieldGroup>
            {register && (
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">{m.name}</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  disabled={pending}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                <FieldError id="name-error">{errors.name}</FieldError>
              </Field>
            )}
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">{m.email}</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                disabled={pending}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              <FieldError id="email-error">{errors.email}</FieldError>
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="password">{m.password}</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={12}
                maxLength={128}
                disabled={pending}
                aria-invalid={!!errors.password}
                aria-describedby="password-help password-error"
              />
              <FieldDescription id="password-help">
                {m.passwordHelp}
              </FieldDescription>
              <FieldError id="password-error">{errors.password}</FieldError>
            </Field>
            {register && (
              <FieldSet disabled={pending}>
                <FieldLegend>{m.role}</FieldLegend>
                <FieldGroup>
                  <Field orientation="horizontal">
                    <input
                      type="radio"
                      id="student"
                      name="role"
                      value="student"
                      defaultChecked
                    />
                    <FieldLabel htmlFor="student">{m.student}</FieldLabel>
                  </Field>
                  <Field orientation="horizontal">
                    <input
                      type="radio"
                      id="teacher"
                      name="role"
                      value="teacher"
                    />
                    <FieldLabel htmlFor="teacher">{m.teacher}</FieldLabel>
                  </Field>
                </FieldGroup>
                <FieldError>{errors.role}</FieldError>
              </FieldSet>
            )}
          </FieldGroup>
          {!register && <Link className="auth-forgot-link" href="/forgot-password">{m.forgotPassword}</Link>}
          <FormError message={error} />
          <Button type="submit" disabled={pending}>
            {pending && (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            )}
            {pending ? m.working : register ? m.register : m.login}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="gap-2">
        <span>{register ? m.haveAccount : m.needAccount}</span>
        <Link
          className="underline underline-offset-4"
          href={register ? "/login" : "/register"}
        >
          {register ? m.login : m.register}
        </Link>
      </CardFooter>
    </Card>
  );
}
