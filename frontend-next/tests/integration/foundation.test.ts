import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/db/client";
import { POST as authPOST } from "@/app/api/auth/[...all]/route";
import { GET as list, POST as create } from "@/app/api/classrooms/route";
import {
  GET as read,
  PATCH as update,
  DELETE as remove,
} from "@/app/api/classrooms/[id]/route";
import { POST as join } from "@/app/api/classrooms/join/route";

const users: string[] = [];
const classrooms: string[] = [];
const origin = process.env.BETTER_AUTH_URL!;
const course = {
  name: "Data Structures & Algorithms",
  description: "Foundation test",
  academicLevel: "Undergraduate",
  language: "English",
  durationWeeks: 12,
  status: "active",
};
let teacher: string;
let otherTeacher: string;
let student: string;
let otherStudent: string;
let classroomId: string;
let code: string;
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
const context = (id = classroomId) => ({ params: Promise.resolve({ id }) });
async function signup(role: "teacher" | "student") {
  const signupRequest = request("/api/auth/sign-up/email", "", {
    name: `Test ${role}`,
    email: `${randomUUID()}@example.com`,
    password: "Foundation-password-123",
    role,
  });
  // Simulate distinct clients without disabling Better Auth's signup rate limit.
  signupRequest.headers.set(
    "x-forwarded-for",
    `198.51.100.${users.length + 1}`,
  );
  const response = await authPOST(signupRequest);
  expect(response.status).toBe(200);
  const body = await response.json();
  users.push(body.user.id);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
beforeAll(async () => {
  teacher = await signup("teacher");
  otherTeacher = await signup("teacher");
  student = await signup("student");
  otherStudent = await signup("student");
});
afterAll(async () => {
  const db = getDatabase();
  await db.classroom.deleteMany({ where: { id: { in: classrooms } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
describe("real PostgreSQL, Better Auth and classroom routes", () => {
  it("rejects oversized signup bodies without buffering a cloned stream", async () => {
    const response = await authPOST(
      request("/api/auth/sign-up/email", "", {
        name: "x".repeat(20_000),
        email: "oversized@example.com",
        password: "Foundation-password-123",
        role: "student",
      }),
    );
    expect(response.status).toBe(413);
  });
  it("requires authentication and rejects unauthorized roles and malformed input", async () => {
    expect((await list(request("/api/classrooms"))).status).toBe(401);
    expect(
      (await create(request("/api/classrooms", student, course))).status,
    ).toBe(403);
    expect(
      (
        await create(
          request("/api/classrooms", teacher, { ...course, durationWeeks: 0 }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await authPOST(
          request("/api/auth/sign-up/email", "", {
            name: "Admin",
            email: "admin@example.com",
            password: "Foundation-password-123",
            role: "admin",
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("creates a classroom with a unique join code", async () => {
    const response = await create(request("/api/classrooms", teacher, course));
    expect(response.status).toBe(201);
    classroomId = (await response.json()).id;
    classrooms.push(classroomId);
    const detail = await (
      await read(request(`/api/classrooms/${classroomId}`, teacher), context())
    ).json();
    code = detail.joinCode;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(detail.enrollments).toEqual([]);
    const second = await create(request("/api/classrooms", teacher, course));
    const secondId = (await second.json()).id;
    classrooms.push(secondId);
    const secondDetail = await (
      await read(
        request(`/api/classrooms/${secondId}`, teacher),
        context(secondId),
      )
    ).json();
    expect(secondDetail.joinCode).not.toBe(code);
  });
  it("isolates reads, updates, deletion and lists by ownership/membership", async () => {
    for (const cookie of [otherTeacher, student, otherStudent])
      expect(
        (
          await read(
            request(`/api/classrooms/${classroomId}`, cookie),
            context(),
          )
        ).status,
      ).toBe(404);
    expect(
      (
        await update(
          request(
            `/api/classrooms/${classroomId}`,
            otherTeacher,
            course,
            "PATCH",
          ),
          context(),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await remove(
          request(
            `/api/classrooms/${classroomId}`,
            otherTeacher,
            undefined,
            "DELETE",
          ),
          context(),
        )
      ).status,
    ).toBe(404);
    expect(
      await (await list(request("/api/classrooms", otherTeacher))).json(),
    ).toEqual([]);
  });
  it("enrolls once under concurrent repeated requests; students never receive codes or classmates", async () => {
    const results = await Promise.all([
      join(
        request("/api/classrooms/join", student, { code: code.toLowerCase() }),
      ),
      join(request("/api/classrooms/join", student, { code })),
    ]);
    results.forEach((response) => expect(response.status).toBe(200));
    expect(
      await getDatabase().enrollment.count({ where: { classroomId } }),
    ).toBe(1);
    const detail = await (
      await read(request(`/api/classrooms/${classroomId}`, student), context())
    ).json();
    expect(detail).not.toHaveProperty("joinCode");
    expect(detail).not.toHaveProperty("enrollments");
    expect(detail).not.toHaveProperty("teacherId");
    const studentList = await (
      await list(request("/api/classrooms", student))
    ).json();
    expect(studentList).toHaveLength(1);
    expect(studentList[0]).not.toHaveProperty("joinCode");
    expect(
      (
        await read(
          request(`/api/classrooms/${classroomId}`, otherStudent),
          context(),
        )
      ).status,
    ).toBe(404);
    expect(
      (await join(request("/api/classrooms/join", teacher, { code }))).status,
    ).toBe(403);
    expect(
      (
        await update(
          request(`/api/classrooms/${classroomId}`, student, course, "PATCH"),
          context(),
        )
      ).status,
    ).toBe(403);
  });
  it("blocks role changes, foreign origins and invalid codes", async () => {
    expect(
      (
        await authPOST(
          request("/api/auth/update-user", student, { role: "teacher" }),
        )
      ).status,
    ).toBe(403);
    const foreign = request("/api/classrooms", teacher, course);
    foreign.headers.set("origin", "https://attacker.example");
    expect((await create(foreign)).status).toBe(403);
    expect(
      (
        await join(
          request("/api/classrooms/join", otherStudent, { code: "ZZZZZZZZ" }),
        )
      ).status,
    ).toBe(404);
  });
  it("updates and archives classrooms while preserving enrolled access", async () => {
    const response = await update(
      request(
        `/api/classrooms/${classroomId}`,
        teacher,
        { ...course, name: "Updated DSA", status: "archived" },
        "PATCH",
      ),
      context(),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).name).toBe("Updated DSA");
    expect(
      (await join(request("/api/classrooms/join", otherStudent, { code })))
        .status,
    ).toBe(404);
    expect(
      (
        await read(
          request(`/api/classrooms/${classroomId}`, student),
          context(),
        )
      ).status,
    ).toBe(200);
  });
  it("deletes classroom and enrollments atomically without deleting student accounts", async () => {
    expect(
      (
        await remove(
          request(
            `/api/classrooms/${classroomId}`,
            teacher,
            undefined,
            "DELETE",
          ),
          context(),
        )
      ).status,
    ).toBe(204);
    expect(
      await getDatabase().enrollment.count({ where: { classroomId } }),
    ).toBe(0);
    expect(
      await getDatabase().user.count({ where: { id: { in: users } } }),
    ).toBe(4);
    expect(
      (
        await read(
          request(`/api/classrooms/${classroomId}`, student),
          context(),
        )
      ).status,
    ).toBe(404);
  });
  it("logout revokes session access", async () => {
    expect(
      (await authPOST(request("/api/auth/sign-out", student, {}))).status,
    ).toBe(200);
    expect((await list(request("/api/classrooms", student))).status).toBe(401);
  });
});
