import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { getDatabase } from "@/db/client";
import { roleSchema } from "@/features/auth/schema";
import { messages } from "@/lib/messages";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL)
    throw new Error(
      "Configure BETTER_AUTH_SECRET (32+ characters) and BETTER_AUTH_URL",
    );
  return betterAuth({
    appName: messages.app,
    secret,
    baseURL,
    trustedOrigins: [new URL(baseURL).origin],
    database: prismaAdapter(getDatabase(), { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.RESEND_FROM_EMAIL;
        if (!apiKey || !from)
          throw new Error("Password reset email is not configured");
        const safeUrl = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [user.email],
            subject: `Reset your ${messages.app} password`,
            text: `Use this secure link to reset your password. It expires in 30 minutes.\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
            html: `<p>Use this secure link to reset your ${messages.app} password. It expires in 30 minutes.</p><p><a href="${safeUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
          throw new Error("Password reset email could not be delivered");
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "student",
          input: true,
          validator: { input: roleSchema },
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const role = roleSchema.safeParse(
              "role" in user ? user.role : "student",
            );
            if (!role.success)
              throw new APIError("BAD_REQUEST", {
                message: messages.invalidRole,
              });
            return { data: { ...user, role: role.data } };
          },
        },
        update: {
          before: async (user) => {
            if ("role" in user)
              throw new APIError("FORBIDDEN", {
                message: messages.invalidRole,
              });
            return { data: user };
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true, window: 60, max: 60 },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(baseURL).protocol === "https:",
      },
    },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
