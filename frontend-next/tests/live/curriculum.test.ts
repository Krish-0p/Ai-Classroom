import { it, expect } from "vitest";
import { configuredProviders, routeCurriculum } from "@/ai/router/curriculum";
import { curriculumPrompt } from "@/ai/prompts/curriculum";
import { curriculumSchema } from "@/features/curriculum/schema";
it("extracts a validated draft from synthetic DSA text using configured providers", async () => {
  expect(configuredProviders().length).toBeGreaterThan(0);
  const result = await routeCurriculum(
    curriculumPrompt(
      {
        name: "Data Structures",
        academicLevel: "Undergraduate",
        language: "English",
      },
      [
        {
          filename: "Synthetic syllabus",
          extractedText:
            "Unit 1: Graph Algorithms. Queue: FIFO operations, needed before BFS. Graph fundamentals: vertices, edges, adjacency lists. BFS: breadth-first traversal using queues, requires graph fundamentals and Queue. DFS: depth-first traversal using recursion, requires graph fundamentals. Outcomes: explain graph representations, implement BFS and DFS.",
        },
      ],
    ),
  );
  expect(curriculumSchema.safeParse(result).success).toBe(true);
  expect(result.units.flatMap((unit) => unit.concepts).length).toBeGreaterThan(
    1,
  );
});
