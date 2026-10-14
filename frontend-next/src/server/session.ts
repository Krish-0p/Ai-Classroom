import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/db/client";
import type { Actor } from "@/features/auth/schema";
import { AppError } from "@/server/errors";
import { messages } from "@/lib/messages";

export async function currentActor(
  requestHeaders: Headers,
): Promise<Actor | null> {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return getDatabase().user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true },
  });
}
export async function requireActor(request: Request): Promise<Actor> {
  const actor = await currentActor(request.headers);
  if (!actor) throw new AppError(401, messages.unauthorized);
  return actor;
}
export async function requirePageActor(): Promise<Actor> {
  const actor = await currentActor(await headers());
  if (!actor) redirect("/login");
  return actor;
}
