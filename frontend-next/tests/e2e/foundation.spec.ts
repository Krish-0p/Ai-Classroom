import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function register(page: Page, role: "Teacher" | "Student") {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(`Demo ${role}`);
  const email = `${randomUUID()}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Foundation-password-123");
  await page.getByRole("radio", { name: role, exact: true }).check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return email;
}
test("teacher creates and edits; student joins; ownership and logout remain enforced", async ({
  page,
  browser,
}, testInfo) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  const teacherEmail = await register(page, "Teacher");
  await expect(page.getByText("No classrooms yet")).toBeVisible();
  await page
    .getByRole("link", { name: "Create classroom", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Create classroom", exact: true })
    .click();
  await expect(
    page.getByText("Enter a course name between 2 and 120 characters."),
  ).toBeVisible();
  await page.getByLabel("Course name").fill("Data Structures & Algorithms");
  await page.getByLabel("Academic level").fill("Undergraduate");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Learn foundational data structures together.");
  await page
    .getByRole("button", { name: "Create classroom", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Data Structures & Algorithms",
      exact: true,
    }),
  ).toBeVisible();
  const classroomPath = new URL(page.url()).pathname;
  const code = await page.locator("code").innerText();
  await expect(page.getByText("No students enrolled yet")).toBeVisible();
  await page.getByRole("link", { name: "Edit classroom" }).click();
  await page.getByLabel("Course name").fill("DSA Foundation");
  await page.getByRole("button", { name: "Save classroom" }).click();
  await expect(
    page.getByRole("heading", { name: "DSA Foundation", exact: true }),
  ).toBeVisible();

  const studentContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
    viewport: page.viewportSize(),
  });
  const student = await studentContext.newPage();
  await register(student, "Student");
  await expect(student.getByText("No classrooms yet")).toBeVisible();
  await student.getByLabel("Join code", { exact: true }).fill("ZZZZZZZZ");
  await student.getByRole("button", { name: "Join classroom" }).click();
  await expect(
    student.getByRole("alert").filter({
      hasText: "This code is invalid or the classroom is archived.",
    }),
  ).toBeVisible();
  await student.getByLabel("Join code", { exact: true }).fill(code);
  await student.getByRole("button", { name: "Join classroom" }).click();
  await expect(
    student.getByRole("heading", { name: "DSA Foundation", exact: true }),
  ).toBeVisible();
  await expect(student.getByText(code, { exact: true })).toHaveCount(0);
  await expect(
    student.getByRole("link", { name: "Edit classroom" }),
  ).toHaveCount(0);
  await student.goto(`${classroomPath}/edit`);
  await expect(student).toHaveURL(/\/dashboard$/);
  await page.reload();
  await expect(page.getByText("Demo Student", { exact: true })).toBeVisible();
  for (const current of [page, student])
    expect(
      await current.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("teacher-classroom.png"),
    fullPage: true,
  });
  await student.screenshot({
    path: testInfo.outputPath("student-dashboard.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill(teacherEmail);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Foundation-password-123");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(classroomPath);
  await page
    .getByRole("button", { name: "Delete classroom", exact: true })
    .click();
  await expect(
    page.getByText(
      "This permanently deletes the classroom and its enrollments. Student accounts remain.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("No classrooms yet")).toBeVisible();
  await student.goto(classroomPath);
  await expect(student.getByText("Classroom unavailable")).toBeVisible();
  await studentContext.close();
});
