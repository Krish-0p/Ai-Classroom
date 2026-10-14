import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { syllabusPdf } from "../fixtures/pdf";
async function register(page: Page, role: "Teacher" | "Student") {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(`Curriculum ${role}`);
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Curriculum-password-123");
  await page.getByRole("radio", { name: role, exact: true }).check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}
test("teacher imports and approves curriculum; students see only approved graphs", async ({
  page,
  browser,
}, testInfo) => {
  await register(page, "Teacher");
  await page
    .getByRole("link", { name: "Create classroom", exact: true })
    .last()
    .click();
  await page.getByLabel("Course name").fill("DSA Curriculum");
  await page.getByLabel("Academic level").fill("Undergraduate");
  await page
    .getByRole("button", { name: "Create classroom", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "DSA Curriculum", exact: true }),
  ).toBeVisible();
  const classroomPath = new URL(page.url()).pathname;
  const code = await page.locator("code").innerText();
  await page.getByRole("link", { name: "Curriculum", exact: true }).click();
  await page.getByLabel("Source name").fill("DSA syllabus");
  await page
    .getByLabel("Paste syllabus or notes")
    .fill(
      "Graph Algorithms: Queue data structure, breadth-first search, stack and depth-first search.",
    );
  await page.getByRole("button", { name: "Save pasted source" }).click();
  await expect(
    page.getByRole("link", { name: "DSA syllabus", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Source file", { exact: true }).setInputFiles({
    name: "lecture.pdf",
    mimeType: "application/pdf",
    buffer: syllabusPdf(),
  });
  await page
    .getByRole("button", { name: "Upload source", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "lecture.pdf", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Add unit", exact: true }).click();
  await page
    .getByLabel("Unit course title", { exact: true })
    .fill("Graph Algorithms");
  await page.getByLabel("Concept course title", { exact: true }).fill("Queue");
  await page.getByRole("button", { name: "Add concept", exact: true }).click();
  await page
    .getByLabel("Concept course title", { exact: true })
    .last()
    .fill("BFS");
  await page.getByRole("checkbox", { name: "Queue", exact: true }).check();
  await page
    .getByLabel("Learning outcomes (one per line)")
    .fill("Explain BFS using a queue");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approve saved draft for students" }),
  ).toBeEnabled();
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
    viewport: page.viewportSize(),
  });
  const student = await context.newPage();
  await register(student, "Student");
  await student.getByLabel("Join code", { exact: true }).fill(code);
  await student
    .getByRole("button", { name: "Join classroom", exact: true })
    .click();
  await expect(
    student.getByRole("heading", { name: "DSA Curriculum", exact: true }),
  ).toBeVisible();
  await student.getByRole("link", { name: "Curriculum", exact: true }).click();
  await expect(student.getByText("Curriculum not published yet")).toBeVisible();
  await expect(
    student.getByRole("heading", { name: "Teacher draft" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Approve saved draft for students" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Approved curriculum: DSA Curriculum",
      exact: true,
    }),
  ).toBeVisible();
  await student.reload();
  await expect(
    student.getByRole("img", { name: "Concept knowledge graph" }),
  ).toBeVisible();
  await expect(
    student.getByText("Prerequisites: Queue", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Course title", { exact: true })
    .fill("PRIVATE UPDATED DRAFT");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByLabel("Course title", { exact: true })).toHaveValue(
    "PRIVATE UPDATED DRAFT",
  );
  await student.reload();
  await expect(student.getByText("PRIVATE UPDATED DRAFT")).toHaveCount(0);
  for (const current of [page, student])
    expect(
      await current.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("teacher-curriculum.png"),
    fullPage: true,
  });
  await student.screenshot({
    path: testInfo.outputPath("student-curriculum.png"),
    fullPage: true,
  });
  await page.goto(classroomPath);
  await page
    .getByRole("button", { name: "Delete classroom", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await context.close();
});
