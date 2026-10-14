import { PasswordRecoveryPage } from "@/features/auth/password-recovery-page";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[]; error?: string | string[] }> }) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
  return <PasswordRecoveryPage mode="reset" token={token} invalidLink={!!error} />;
}
