import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/features/auth/schema";
import type { Citation } from "@/features/tutor/schema";
import { sourceFingerprint } from "./chunking";
export interface RetrievalStore {
  retrieve(
    db: Prisma.TransactionClient,
    actor: Actor,
    classroomId: string,
    model: string,
    vector: number[],
  ): Promise<Citation[]>;
}
export class PgVectorRetrieval implements RetrievalStore {
  async retrieve(
    db: Prisma.TransactionClient,
    actor: Actor,
    classroomId: string,
    model: string,
    vector: number[],
  ) {
    // Exact cosine search avoids approximate-index filtering losses in small classrooms.
    const sources = await db.sourceDocument.findMany({
      where: {
        classroomId,
        classroom: {
          OR: [
            { teacherId: actor.id },
            { enrollments: { some: { studentId: actor.id } } },
          ],
        },
      },
      select: { contentHash: true },
    });
    if (!sources.length) return [];
    const fingerprints = sources.map((source) =>
      sourceFingerprint(source.contentHash, model),
    );
    const rows = await db.$queryRaw<
      (Citation & {
        distance: number;
        fingerprint: string;
        contentHash: string;
      })[]
    >`
      SELECT c.id, s.id AS "sourceId", s.filename, c.label, c.text,
        i.fingerprint, s."contentHash", (c.embedding <=> ${JSON.stringify(vector)}::vector) AS distance
      FROM "SourceChunk" c JOIN "SourceIndex" i ON i.id=c."indexId"
      JOIN "SourceDocument" s ON s.id=i."sourceId" AND s."classroomId"=i."classroomId"
      JOIN "Curriculum" a ON a."classroomId"=i."classroomId"
      JOIN "Classroom" cl ON cl.id=i."classroomId"
      WHERE i."classroomId"=${classroomId} AND i.model=${model} AND i.ready=true
        AND i.fingerprint IN (${Prisma.join(fingerprints)})
        AND c.embedding IS NOT NULL AND s.id=ANY(a."approvedSourceIds")
        AND (cl."teacherId"=${actor.id} OR EXISTS(SELECT 1 FROM "Enrollment" e WHERE e."classroomId"=cl.id AND e."studentId"=${actor.id}))
      ORDER BY c.embedding <=> ${JSON.stringify(vector)}::vector LIMIT 12`;
    const maximum = Number(process.env.TUTOR_MAX_COSINE_DISTANCE ?? "0.55");
    const threshold =
      Number.isFinite(maximum) && maximum > 0 && maximum < 1 ? maximum : 0.55;
    return rows
      .filter(
        (row) =>
          row.distance <= threshold &&
          row.fingerprint === sourceFingerprint(row.contentHash, model),
      )
      .slice(0, 6)
      .map(({ id, sourceId, filename, label, text }) => ({
        id,
        sourceId,
        filename,
        label,
        text,
      }));
  }
}
