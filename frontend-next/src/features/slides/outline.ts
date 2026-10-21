import type { CurriculumInput } from "@/features/curriculum/schema";
import type { SlideDeckInput } from "./schema";
import { slideMessages as m } from "@/lib/slide-messages";

export function curriculumSlideOutline(
  curriculum: CurriculumInput,
): SlideDeckInput {
  const concepts = curriculum.units.flatMap((unit) => unit.concepts);
  const groups = Array.from({ length: 3 }, (_, index) => {
    const size = Math.max(1, Math.ceil(concepts.length / 3));
    const items = concepts.slice(index * size, (index + 1) * size).slice(0, 4);
    const first = items[0];
    if (!first)
      return {
        heading: index === 1 ? m.outcomes : m.connections,
        explanation: index === 1 ? m.outcomesBody : m.connectionsBody,
        bullets: (curriculum.learningOutcomes.length
          ? curriculum.learningOutcomes
          : concepts.map((concept) => concept.title)
        )
          .slice(0, 4)
          .map((item) => item.slice(0, 240)),
        example: "",
        takeaway: m.recapTakeaway,
        conceptIds: [],
      };
    return {
      heading: first.title,
      explanation: (first.description || first.title).slice(0, 650),
      bullets: items.map((item) => item.title),
      example: "",
      takeaway: first.title,
      conceptIds: items.map((item) => item.id),
    };
  });
  return {
    title: curriculum.courseTitle,
    slides: [
      {
        heading: m.overview,
        explanation: m.overviewBody,
        bullets: curriculum.units.slice(0, 4).map((unit) => unit.title),
        example: "",
        takeaway: (
          curriculum.learningOutcomes[0] || curriculum.courseTitle
        ).slice(0, 240),
        conceptIds: [],
      },
      ...groups,
      {
        heading: m.recap,
        explanation: m.recapBody,
        bullets: (curriculum.learningOutcomes.length
          ? curriculum.learningOutcomes
          : concepts.map((item) => item.title)
        )
          .slice(0, 4)
          .map((item) => item.slice(0, 240)),
        example: "",
        takeaway: m.recapTakeaway,
        conceptIds: [],
      },
    ],
  };
}
