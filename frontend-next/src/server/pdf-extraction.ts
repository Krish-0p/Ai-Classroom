import "server-only";
import { AppError } from "@/server/errors";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
import type { SourceSection } from "@/server/source-extraction";

type PDFParser = InstanceType<typeof import("pdf-parse").PDFParse>;

function logFailure(stage: "initialize" | "extract" | "cleanup") {
  // Parser errors can contain document content or paths. Log only our stage.
  console.error("pdf_processing_failed", { stage });
}

async function createParser(data: Buffer): Promise<PDFParser> {
  try {
    // The worker installs Node canvas globals before PDF.js is evaluated.
    const { CanvasFactory, getData } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    // Embed the matching worker instead of relying on PDF.js's relative path.
    PDFParse.setWorker(getData());
    return new PDFParse({ data, CanvasFactory, isEvalSupported: false });
  } catch {
    logFailure("initialize");
    throw new AppError(503, m.pdfUnavailable);
  }
}

export async function extractPDFSections(
  data: Buffer,
): Promise<SourceSection[]> {
  const parser = await createParser(data);
  try {
    const info = await parser.getInfo();
    if (info.total > 100) throw new AppError(413, m.tooLarge);
    const output = await parser.getText();
    return output.pages.map((page) => ({
      label: `Page ${page.num}`,
      text: page.text,
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error) {
      if (error.name === "PasswordException")
        throw new AppError(422, m.pdfPassword);
      if (["InvalidPDFException", "FormatError"].includes(error.name))
        throw new AppError(422, m.pdfInvalid);
    }
    logFailure("extract");
    throw new AppError(503, m.pdfUnavailable);
  } finally {
    try {
      await parser.destroy();
    } catch {
      // Cleanup must not overwrite a useful extraction error or valid result.
      logFailure("cleanup");
    }
  }
}
