import type { QuestionInput, QuestionResponse } from "./schema";
import { assessmentMessages as m } from "@/lib/assessment-messages";
export function validResponse(q: QuestionInput, response: QuestionResponse) {
  if (response === "" || (Array.isArray(response) && response.length === 0))
    return true;
  if (["short_answer", "explanation", "coding"].includes(q.type))
    return typeof response === "string";
  if (q.type === "numerical")
    return (
      typeof response === "string" &&
      response.trim() !== "" &&
      Number.isFinite(Number(response))
    );
  const ids = new Set(q.options.map((o) => o.id));
  if (q.type === "mcq")
    return typeof response === "string" && ids.has(response);
  if (
    !Array.isArray(response) ||
    response.some(
      (id) =>
        !ids.has(id) &&
        !(["ordering", "matching"].includes(q.type) && id === ""),
    )
  )
    return false;
  if (q.type === "matching") return response.length === q.matchPrompts.length;
  if (
    new Set(response.filter(Boolean)).size !== response.filter(Boolean).length
  )
    return false;
  return q.type !== "ordering" || response.length === q.options.length;
}
export function gradeQuestion(
  q: QuestionInput,
  response: QuestionResponse,
): { marks: number | null; needsReview: boolean; feedback: string } {
  const empty =
    typeof response === "string" ? !response.trim() : !response.length;
  if (empty) return { marks: 0, needsReview: false, feedback: m.unanswered };
  if (["short_answer", "explanation", "coding"].includes(q.type))
    return { marks: null, needsReview: true, feedback: m.pending };
  let fraction = 0;
  if (q.type === "numerical" && typeof response === "string")
    fraction =
      Math.abs(Number(response) - q.numericAnswer!) <= q.tolerance ? 1 : 0;
  if (q.type === "mcq" && typeof response === "string")
    fraction = response === q.answerIds[0] ? 1 : 0;
  if (q.type === "multi_select" && Array.isArray(response))
    fraction =
      response.length === q.answerIds.length &&
      response.every((id) => q.answerIds.includes(id))
        ? 1
        : 0;
  if (q.type === "ordering" && Array.isArray(response))
    fraction = response.every((id, index) => id === q.answerIds[index]) ? 1 : 0;
  if (q.type === "matching" && Array.isArray(response))
    fraction =
      response.filter((id, index) => id === q.answerIds[index]).length /
      q.answerIds.length;
  return {
    marks: Math.round(q.marks * fraction * 100) / 100,
    needsReview: false,
    feedback:
      fraction === 1 ? m.correct : fraction === 0 ? m.incorrect : m.partial,
  };
}
