import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
export function getDatabase() {
  if (globalDatabase.prisma) return globalDatabase.prisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  const adapter = new PrismaPg({
    connectionString,
    max: process.env.VERCEL === "1" ? 5 : 10,
    connectionTimeoutMillis: 10_000,
  });
  globalDatabase.prisma = new PrismaClient({ adapter });
  return globalDatabase.prisma;
}
