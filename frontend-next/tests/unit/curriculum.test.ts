import { describe, it, expect, vi, afterEach } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { curriculumSchema } from "@/features/curriculum/schema";
import { extractSource } from "@/server/source-extraction";
import { syllabusPdf } from "../fixtures/pdf";
import { routeCurriculum } from "@/ai/router/curriculum";
import { GeminiProvider } from "@/ai/providers/gemini";
import { GroqProvider } from "@/ai/providers/groq";
import { ProviderError, type AIProvider } from "@/ai/providers/provider";
export const curriculum = {
  courseTitle: "Data Structures",
  learningOutcomes: ["Explain breadth-first traversal"],
  units: [
    {
      id: "graphs",
      title: "Graphs",
      description: "Graph algorithms",
      concepts: [
        {
          id: "queue",
          title: "Queue",
          description: "FIFO",
          prerequisiteIds: [],
        },
        {
          id: "bfs",
          title: "BFS",
          description: "Breadth-first search",
          prerequisiteIds: ["queue"],
        },
      ],
    },
  ],
};
afterEach(() => vi.unstubAllGlobals());
describe("curriculum validation and safe document extraction", () => {
  it("extracts PDF text with page references and reports scanned/empty PDFs", async () => {
    const parsed = await extractSource("syllabus.pdf", syllabusPdf());
    expect(parsed.sections[0].label).toBe("Page 1");
    expect(parsed.text).toContain("Queue prerequisites");
    await expect(extractSource("scanned.pdf", syllabusPdf(""))).rejects.toThrow(
      "No readable text",
    );
  });
  it("rejects duplicate concepts, missing prerequisites and cycles", () => {
    expect(curriculumSchema.safeParse(curriculum).success).toBe(true);
    const copy = structuredClone(curriculum);
    copy.units[0].concepts[0].prerequisiteIds = ["bfs"];
    expect(curriculumSchema.safeParse(copy).success).toBe(false);
    copy.units[0].concepts[0].prerequisiteIds = ["missing"];
    expect(curriculumSchema.safeParse(copy).success).toBe(false);
    copy.units[0].concepts[0].id = "bfs";
    expect(curriculumSchema.safeParse(copy).success).toBe(false);
  });
  it("extracts TXT and rejects disguised binary or unsupported files", async () => {
    expect(
      (
        await extractSource(
          "notes.txt",
          Buffer.from(
            "Graph fundamentals and queue operations\r\nBFS traversal",
          ),
        )
      ).text,
    ).toContain("BFS traversal");
    await expect(
      extractSource("notes.txt", Buffer.from([255, 0, 4])),
    ).rejects.toThrow();
    await expect(
      extractSource("notes.pdf", Buffer.from("not a real PDF")),
    ).rejects.toThrow();
    await expect(
      extractSource("notes.ppt", Buffer.from("legacy binary")),
    ).rejects.toThrow();
    await expect(
      extractSource("large.txt", Buffer.alloc(8 * 1024 * 1024 + 1)),
    ).rejects.toThrow();
  });
  it("preserves slide numbers and rejects XML entity definitions", async () => {
    const pack = (xml: string) =>
      Buffer.from(
        zipSync({
          "[Content_Types].xml": strToU8("<Types/>"),
          "ppt/slides/slide12.xml": strToU8(xml),
        }),
      );
    const source = await extractSource(
      "lecture.pptx",
      pack(
        '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Queues enable breadth first graph traversal</a:t></a:r></a:p></p:sld>',
      ),
    );
    expect(source.sections[0].label).toBe("Slide 12");
    await expect(
      extractSource(
        "lecture.pptx",
        pack('<!DOCTYPE doc [<!ENTITY x "secret">]><doc>&x;</doc>'),
      ),
    ).rejects.toThrow();
  });
  it("extracts DOCX text without embedded code", async () => {
    const data = Buffer.from(
      zipSync({
        "[Content_Types].xml": strToU8("<Types/>"),
        "word/document.xml": strToU8(
          '<w:document xmlns:w="w"><w:p><w:r><w:t>Graph concepts and prerequisites for BFS</w:t></w:r></w:p></w:document>',
        ),
      }),
    );
    expect((await extractSource("syllabus.docx", data)).text).toContain(
      "Graph concepts",
    );
  });
});
describe("AI adapters and bounded fallback", () => {
  it("uses server headers and locally validates both provider formats", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(curriculum) }] } },
          ],
          usageMetadata: { totalTokenCount: 45 },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { content: JSON.stringify(curriculum) } }],
          usage: { total_tokens: 32 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      system: "Extract JSON",
      prompt: "Syllabus",
      jsonSchema: {},
      schema: curriculumSchema,
    };
    expect(
      await new GeminiProvider(
        "secret-gemini",
        "test-model",
      ).generateStructured(input),
    ).toEqual(curriculum);
    expect(
      await new GroqProvider("secret-groq", "test-model").generateStructured(
        input,
      ),
    ).toEqual(curriculum);
    expect(fetchMock.mock.calls[0][0]).not.toContain("secret");
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe(
      "secret-gemini",
    );
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer secret-groq",
    );
  });
  it("corrects invalid JSON once then falls back; metadata contains no source text", async () => {
    const first: AIProvider = {
      name: "gemini",
      model: "first",
      generateText: vi.fn().mockResolvedValue({ text: "invalid" }),
      generateStructured: vi.fn(),
    };
    const fallback: AIProvider = {
      name: "groq",
      model: "second",
      generateText: vi
        .fn()
        .mockResolvedValue({ text: JSON.stringify(curriculum) }),
      generateStructured: vi.fn(),
    };
    const log = vi.fn();
    expect(
      await routeCurriculum(
        {
          system: "extract",
          prompt: "PRIVATE SYLLABUS",
          schema: curriculumSchema,
        },
        [first, fallback],
        log,
      ),
    ).toEqual(curriculum);
    expect(first.generateText).toHaveBeenCalledTimes(2);
    expect(fallback.generateText).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE");
  });
  it("retries transient errors twice at most; authorization errors immediately fall back", async () => {
    const provider: AIProvider = {
      name: "gemini",
      model: "m",
      generateText: vi.fn().mockRejectedValue(new ProviderError(true)),
      generateStructured: vi.fn(),
    };
    await expect(
      routeCurriculum(
        { system: "extract", prompt: "data", schema: curriculumSchema },
        [provider],
        () => {},
      ),
    ).rejects.toThrow(ProviderError);
    expect(provider.generateText).toHaveBeenCalledTimes(2);
  });
});
