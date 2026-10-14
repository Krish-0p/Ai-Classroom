import "server-only";
import { fromBuffer, type Entry, type ZipFile } from "yauzl";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { AppError } from "@/server/errors";
import { curriculumMessages as m } from "@/lib/curriculum-messages";

export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const MAX_SOURCE_TEXT = 120_000;
export type SourceSection = { label: string; text: string };
export type ExtractedSource = {
  mimeType: string;
  text: string;
  sections: SourceSection[];
};
export function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim();
}
function result(mimeType: string, sections: SourceSection[]): ExtractedSource {
  sections = sections
    .map((section) => ({ ...section, text: normalizeText(section.text) }))
    .filter((section) => section.text);
  const text = sections
    .map((section) => `[${section.label}]\n${section.text}`)
    .join("\n\n");
  if (text.length > MAX_SOURCE_TEXT) throw new AppError(413, m.tooLarge);
  if (sections.reduce((sum, section) => sum + section.text.length, 0) < 20)
    throw new AppError(422, m.noText);
  return { mimeType, text, sections };
}
async function officeEntries(
  data: Buffer,
  pptx: boolean,
): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    fromBuffer(
      data,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) return reject(new AppError(422, m.invalidSource));
        readZip(zip, pptx, resolve, reject);
      },
    );
  });
}
function readZip(
  zip: ZipFile,
  pptx: boolean,
  resolve: (value: Map<string, string>) => void,
  reject: (reason: Error) => void,
) {
  const files = new Map<string, string>();
  let count = 0,
    total = 0,
    settled = false;
  const fail = (error: Error) => {
    if (!settled) {
      settled = true;
      zip.close();
      reject(error);
    }
  };
  zip.on("error", () => fail(new AppError(422, m.invalidSource)));
  zip.on("end", () => {
    if (!settled) {
      settled = true;
      resolve(files);
    }
  });
  zip.on("entry", (entry: Entry) => {
    total += entry.uncompressedSize;
    if (
      ++count > 2000 ||
      total > 32 * 1024 * 1024 ||
      entry.uncompressedSize > 8 * 1024 * 1024 ||
      entry.generalPurposeBitFlag & 1
    )
      return fail(new AppError(413, m.tooLarge));
    const selected =
      entry.fileName === "[Content_Types].xml" ||
      (pptx
        ? /^ppt\/slides\/slide\d+\.xml$/.test(entry.fileName)
        : entry.fileName === "word/document.xml");
    if (!selected) {
      zip.readEntry();
      return;
    }
    if (files.has(entry.fileName))
      return fail(new AppError(422, m.invalidSource));
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) return fail(new AppError(422, m.invalidSource));
      const chunks: Buffer[] = [];
      let bytes = 0;
      stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 8 * 1024 * 1024) {
          stream.destroy();
          fail(new AppError(413, m.tooLarge));
        } else chunks.push(chunk);
      });
      stream.on("error", () => fail(new AppError(422, m.invalidSource)));
      stream.on("end", () => {
        if (!settled) {
          files.set(entry.fileName, Buffer.concat(chunks).toString("utf8"));
          zip.readEntry();
        }
      });
    });
  });
  zip.readEntry();
}
function xmlText(xml: string): string {
  // Office XML is data. Reject entity definitions rather than expanding untrusted DTDs.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw new AppError(422, m.invalidSource);
  const parsed: unknown = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: false,
  }).parse(xml);
  const lines: string[] = [];
  function collect(node: unknown, depth: number, tag = "") {
    if (depth > 100) throw new AppError(422, m.invalidSource);
    if (typeof node === "string" && /(^|:)t$/.test(tag)) lines.push(node);
    else if (Array.isArray(node))
      node.forEach((value) => collect(value, depth + 1, tag));
    else if (node && typeof node === "object")
      for (const [key, value] of Object.entries(node)) {
        collect(value, depth + 1, key);
        if (/(^|:)p$/.test(key)) lines.push("\n");
      }
  }
  collect(parsed, 0);
  return lines.join(" ");
}
export async function extractSource(
  filename: string,
  data: Buffer,
): Promise<ExtractedSource> {
  if (!data.length || data.length > MAX_SOURCE_BYTES)
    throw new AppError(413, m.tooLarge);
  const extension = filename.toLowerCase().split(".").pop();
  try {
    if (extension === "txt") {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
      if (text.includes("\u0000")) throw new AppError(422, m.invalidSource);
      return result("text/plain", [{ label: "Text", text }]);
    }
    if (extension === "pdf" && data.subarray(0, 5).toString() === "%PDF-") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data, isEvalSupported: false });
      try {
        const info = await parser.getInfo();
        if (info.total > 100) throw new AppError(413, m.tooLarge);
        const output = await parser.getText();
        return result(
          "application/pdf",
          output.pages.map((page) => ({
            label: `Page ${page.num}`,
            text: page.text,
          })),
        );
      } finally {
        await parser.destroy();
      }
    }
    if (
      (extension === "docx" || extension === "pptx") &&
      data.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
    ) {
      const pptx = extension === "pptx";
      const files = await officeEntries(data, pptx);
      if (!files.has("[Content_Types].xml"))
        throw new AppError(422, m.invalidSource);
      const names = [...files.keys()]
        .filter((name) => name !== "[Content_Types].xml")
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (!names.length || names.length > 100)
        throw new AppError(422, m.invalidSource);
      return result(
        `application/vnd.openxmlformats-officedocument.${pptx ? "presentationml.presentation" : "wordprocessingml.document"}`,
        names.map((name) => ({
          label: pptx ? `Slide ${name.match(/slide(\d+)/)?.[1]}` : "Document",
          text: xmlText(files.get(name)!),
        })),
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(422, m.invalidSource);
  }
  throw new AppError(415, m.invalidSource);
}
