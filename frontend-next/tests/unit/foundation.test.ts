import { describe, expect, it, vi } from "vitest";
import { classroomSchema, joinSchema } from "@/features/classrooms/schema";
import { registrationSchema, roleSchema } from "@/features/auth/schema";
import { generateJoinCode, requireTeacher } from "@/server/classrooms";
import { parseBody, checkOrigin } from "@/server/http";
import { handleError } from "@/server/errors";

const valid = {
  name: "Data Structures",
  academicLevel: "Undergraduate",
  language: "English",
  durationWeeks: 12,
};
describe("Foundation boundaries", () => {
  it("redacts internal error messages from HTTP responses and logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = handleError(new Error("sensitive-connection-string"));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain(
        "sensitive-connection-string",
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        "sensitive-connection-string",
      );
    } finally {
      log.mockRestore();
    }
  });
  it("normalizes classroom content and rejects invalid durations / unknown ownership fields", () => {
    expect(
      classroomSchema.parse({ ...valid, name: "  Data Structures  " }).name,
    ).toBe("Data Structures");
    for (const durationWeeks of [0, 105, 1.5, "12"])
      expect(
        classroomSchema.safeParse({ ...valid, durationWeeks }).success,
      ).toBe(false);
    expect(
      classroomSchema.safeParse({ ...valid, teacherId: "attacker" }).success,
    ).toBe(false);
    expect(
      classroomSchema.safeParse({ ...valid, description: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });
  it("rejects public admin signup and weak passwords", () => {
    expect(roleSchema.safeParse("admin").success).toBe(false);
    expect(
      registrationSchema.safeParse({
        name: "Student",
        email: "s@example.com",
        password: "short",
        role: "student",
      }).success,
    ).toBe(false);
  });
  it("normalizes codes without allowing ambiguous characters", () => {
    expect(joinSchema.parse({ code: " abcdefgh " }).code).toBe("ABCDEFGH");
    expect(joinSchema.safeParse({ code: "ABCDEF01" }).success).toBe(false);
    for (let i = 0; i < 100; i++)
      expect(joinSchema.safeParse({ code: generateJoinCode() }).success).toBe(
        true,
      );
  });
  it("enforces teacher roles independently of UI", () => {
    expect(() =>
      requireTeacher({ id: "student", name: "Student", role: "student" }),
    ).toThrow();
    expect(() =>
      requireTeacher({ id: "teacher", name: "Teacher", role: "teacher" }),
    ).not.toThrow();
  });
  it("rejects malformed and oversized bodies", async () => {
    const request = (body: string) =>
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    await expect(
      parseBody(request("{"), classroomSchema),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      parseBody(request("x".repeat(20000)), classroomSchema),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects foreign and missing mutation origins", () => {
    const original = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    try {
      expect(() =>
        checkOrigin(
          new Request("http://localhost/api", {
            headers: { Origin: "https://attacker.example" },
          }),
        ),
      ).toThrow();
      expect(() => checkOrigin(new Request("http://localhost/api"))).toThrow();
      expect(() =>
        checkOrigin(
          new Request("http://localhost/api", {
            headers: { Origin: "http://localhost:3000" },
          }),
        ),
      ).not.toThrow();
    } finally {
      if (original === undefined) delete process.env.BETTER_AUTH_URL;
      else process.env.BETTER_AUTH_URL = original;
    }
  });
});
