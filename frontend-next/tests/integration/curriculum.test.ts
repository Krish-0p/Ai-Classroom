import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/db/client";
import { demoCurriculum as curriculum } from "../fixtures/curriculum";
import { POST as signupRoute } from "@/app/api/auth/[...all]/route";
import { POST as createRoute } from "@/app/api/classrooms/route";
import { POST as joinRoute } from "@/app/api/classrooms/join/route";
import {
  GET as readRoute,
  PUT as saveRoute,
} from "@/app/api/classrooms/[id]/curriculum/route";
import { POST as approveRoute } from "@/app/api/classrooms/[id]/curriculum/approve/route";
import { POST as sourceRoute } from "@/app/api/classrooms/[id]/sources/route";
import { GET as downloadRoute } from "@/app/api/classrooms/[id]/sources/[sourceId]/route";
import {
  startCurriculumJob,
  runCurriculumJob,
  readCurriculumJob,
} from "@/server/curriculum-jobs";
import { sourceStorage } from "@/server/storage";
import { routeCurriculum } from "@/ai/router/curriculum";
import type { Actor } from "@/features/auth/schema";
vi.mock("@/ai/router/curriculum", () => ({
  configuredProviders: () => [{ name: "gemini", model: "test" }],
  routeCurriculum: vi.fn(),
}));
const db = getDatabase();
const users: string[] = [],
  classes: string[] = [];
const origin = process.env.BETTER_AUTH_URL!;
let teacher: string,
  outsider: string,
  student: string,
  stranger: string,
  id: string,
  otherId: string,
  sourceId: string;
let actor: Actor;
function request(
  path: string,
  cookie = "",
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      Origin: new URL(origin).origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const context = (classroomId = id) => ({
  params: Promise.resolve({ id: classroomId }),
});
async function signup(role: "teacher" | "student") {
  const req = request("/api/auth/sign-up/email", "", {
    name: `Curriculum ${role}`,
    email: `${randomUUID()}@example.com`,
    password: "Curriculum-password-123",
    role,
  });
  req.headers.set("x-forwarded-for", `198.51.100.${users.length + 100}`);
  const response = await signupRoute(req);
  expect(response.status).toBe(200);
  const body = await response.json();
  users.push(body.user.id);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
beforeAll(async () => {
  teacher = await signup("teacher");
  actor = { id: users[0], role: "teacher", name: "Test" };
  outsider = await signup("teacher");
  student = await signup("student");
  stranger = await signup("student");
  const data = {
    name: "DSA",
    description: "",
    academicLevel: "University",
    language: "English",
    durationWeeks: 12,
    status: "active",
  };
  for (const cookie of [teacher, outsider]) {
    const response = await createRoute(
      request("/api/classrooms", cookie, data),
    );
    expect(response.status).toBe(201);
    classes.push((await response.json()).id);
  }
  [id, otherId] = classes;
  const classroom = await db.classroom.findUniqueOrThrow({ where: { id } });
  expect(
    (
      await joinRoute(
        request("/api/classrooms/join", student, { code: classroom.joinCode }),
      )
    ).status,
  ).toBe(200);
});
afterAll(async () => {
  const sources = await db.sourceDocument.findMany({
    where: { classroomId: { in: classes } },
    select: { storageKey: true },
  });
  for (const source of sources) await sourceStorage.remove(source.storageKey);
  await db.classroom.deleteMany({ where: { id: { in: classes } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
describe("private curriculum workflow with real sessions and PostgreSQL", () => {
  it("requires authentication, ownership and enrollment", async () => {
    expect((await readRoute(request("/curriculum"), context())).status).toBe(
      401,
    );
    expect(
      (await readRoute(request("/curriculum", outsider), context())).status,
    ).toBe(404);
    expect(
      (await readRoute(request("/curriculum", stranger), context())).status,
    ).toBe(404);
    expect(
      (
        await saveRoute(
          request("/curriculum", student, { version: 0, curriculum }, "PUT"),
          context(),
        )
      ).status,
    ).toBe(403);
    const forged = request(
      "/curriculum",
      teacher,
      { version: 0, curriculum },
      "PUT",
    );
    forged.headers.set("Origin", "https://evil.example");
    expect((await saveRoute(forged, context())).status).toBe(403);
  });
  it("deduplicates private sources and rejects student download/cross-class source references", async () => {
    const input = {
      filename: "syllabus.txt",
      text: "Graph fundamentals. Queue operations. Breadth-first traversal using queues.",
    };
    const response = await sourceRoute(
      request("/sources", teacher, input),
      context(),
    );
    expect(response.status).toBe(201);
    sourceId = (await response.json()).id;
    expect(
      (
        await (
          await sourceRoute(request("/sources", teacher, input), context())
        ).json()
      ).id,
    ).toBe(sourceId);
    const downloadContext = { params: Promise.resolve({ id, sourceId }) };
    expect(
      (await downloadRoute(request("/sources", student), downloadContext))
        .status,
    ).toBe(403);
    expect(
      (await downloadRoute(request("/sources", outsider), downloadContext))
        .status,
    ).toBe(404);
    expect(
      (await downloadRoute(request("/sources", teacher), downloadContext))
        .status,
    ).toBe(200);
    await expect(
      startCurriculumJob(
        { id: users[1], role: "teacher", name: "Other" },
        otherId,
        [sourceId],
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("keeps edits private and approval transactional; stale saves/approvals fail", async () => {
    expect(
      (
        await saveRoute(
          request("/curriculum", teacher, { version: 0, curriculum }, "PUT"),
          context(),
        )
      ).status,
    ).toBe(200);
    let visible = await (
      await readRoute(request("/curriculum", student), context())
    ).json();
    expect(visible.approved).toBeNull();
    expect(visible).not.toHaveProperty("draft");
    expect(visible).not.toHaveProperty("sources");
    expect(
      (
        await approveRoute(
          request("/approve", teacher, { version: 1 }),
          context(),
        )
      ).status,
    ).toBe(200);
    expect(await db.concept.count({ where: { classroomId: id } })).toBe(2);
    const edges = await db.conceptDependency.findMany({
      where: { concept: { classroomId: id } },
      include: { prerequisite: true, concept: true },
    });
    expect(edges[0].prerequisite.key).toBe("queue");
    expect(edges[0].concept.key).toBe("bfs");
    const updated = { ...curriculum, courseTitle: "PRIVATE DRAFT" };
    expect(
      (
        await saveRoute(
          request(
            "/curriculum",
            teacher,
            { version: 1, curriculum: updated },
            "PUT",
          ),
          context(),
        )
      ).status,
    ).toBe(200);
    visible = await (
      await readRoute(request("/curriculum", student), context())
    ).json();
    expect(visible.approved.courseTitle).toBe("Data Structures");
    expect(JSON.stringify(visible)).not.toContain("PRIVATE");
    expect(
      (
        await saveRoute(
          request("/curriculum", teacher, { version: 1, curriculum }, "PUT"),
          context(),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await approveRoute(
          request("/approve", teacher, { version: 1 }),
          context(),
        )
      ).status,
    ).toBe(409);
  });
  it("rejects cycles without changing the saved draft", async () => {
    const invalid = structuredClone(curriculum);
    invalid.units[0].concepts[0].prerequisiteIds = ["bfs"];
    expect(
      (
        await saveRoute(
          request(
            "/curriculum",
            teacher,
            { version: 2, curriculum: invalid },
            "PUT",
          ),
          context(),
        )
      ).status,
    ).toBe(400);
    expect(
      (await db.curriculum.findUniqueOrThrow({ where: { classroomId: id } }))
        .draftVersion,
    ).toBe(2);
  });
  it("completes validated AI jobs without automatically publishing", async () => {
    vi.mocked(routeCurriculum).mockResolvedValue(curriculum);
    const job = await startCurriculumJob(actor, id, [sourceId]);
    await expect(
      startCurriculumJob(actor, id, [sourceId]),
    ).rejects.toMatchObject({ status: 409 });
    await runCurriculumJob(job.id);
    expect((await readCurriculumJob(actor, id, job.id)).status).toBe(
      "complete",
    );
    const row = await db.curriculum.findUniqueOrThrow({
      where: { classroomId: id },
    });
    expect(row.draftVersion).toBe(3);
    expect(row.approvedVersion).toBe(1);
  });
  it("preserves manual edits made while AI runs and marks failed jobs", async () => {
    const cached = await startCurriculumJob(actor, id, [sourceId]);
    expect((await readCurriculumJob(actor, id, cached.id)).status).toBe(
      "complete",
    );
    expect(
      (
        await saveRoute(
          request("/curriculum", teacher, { version: 3, curriculum }, "PUT"),
          context(),
        )
      ).status,
    ).toBe(200);
    const job = await startCurriculumJob(actor, id, [sourceId]);
    vi.mocked(routeCurriculum).mockImplementationOnce(async () => {
      expect(
        (
          await saveRoute(
            request(
              "/curriculum",
              teacher,
              {
                version: 4,
                curriculum: {
                  ...curriculum,
                  courseTitle: "Latest manual edit",
                },
              },
              "PUT",
            ),
            context(),
          )
        ).status,
      ).toBe(200);
      return curriculum;
    });
    await runCurriculumJob(job.id);
    expect((await readCurriculumJob(actor, id, job.id)).status).toBe("failed");
    expect(
      JSON.stringify(
        (await db.curriculum.findUniqueOrThrow({ where: { classroomId: id } }))
          .draft,
      ),
    ).toContain("Latest manual edit");
  });
  it("keeps published curriculum readable in archived classes while blocking changes", async () => {
    await db.classroom.update({ where: { id }, data: { status: "archived" } });
    expect(
      (await readRoute(request("/curriculum", student), context())).status,
    ).toBe(200);
    expect(
      (
        await saveRoute(
          request("/curriculum", teacher, { version: 4, curriculum }, "PUT"),
          context(),
        )
      ).status,
    ).toBe(409);
  });
});
