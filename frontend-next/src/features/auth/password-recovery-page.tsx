import Link from "next/link";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RequestPasswordResetForm, ResetPasswordForm } from "@/features/auth/password-recovery-forms";
import { messages as m } from "@/lib/messages";

export function PasswordRecoveryPage({ mode, token, invalidLink }: { mode: "request" | "reset"; token?: string; invalidLink?: boolean }) {
  return <section className="auth-recovery-layout">
    <Link href="/login" className="auth-back"><GraduationCap aria-hidden="true" /> {m.app} <span>·</span> {m.backToLogin}</Link>
    <div className="auth-recovery-content">
      <div className="auth-recovery-intro"><span><ShieldCheck aria-hidden="true" /></span><p>Secure account recovery</p></div>
      {mode === "request" ? <RequestPasswordResetForm /> : <ResetPasswordForm token={token} invalidLink={invalidLink} />}
      <Card className="auth-recovery-note"><CardContent><p>Reset links expire after 30 minutes. If you did not request a password change, you can safely ignore the email.</p></CardContent></Card>
    </div>
  </section>;
}
