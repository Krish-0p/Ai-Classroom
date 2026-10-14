import type { CurriculumInput } from "@/features/curriculum/schema";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
export function KnowledgeGraph({
  curriculum,
  id = "approved",
}: {
  curriculum: CurriculumInput;
  id?: string;
}) {
  const concepts = curriculum.units.flatMap((unit) => unit.concepts);
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  const levels = new Map<string, number>();
  function level(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    const prerequisites = byId.get(id)?.prerequisiteIds ?? [];
    const value = prerequisites.length
      ? 1 + Math.max(...prerequisites.map(level))
      : 0;
    levels.set(id, value);
    return value;
  }
  const rows = new Map<number, number>();
  const positions = new Map(
    concepts.map((concept) => {
      const column = level(concept.id);
      const row = rows.get(column) ?? 0;
      rows.set(column, row + 1);
      return [concept.id, { x: 20 + column * 250, y: 20 + row * 85 }];
    }),
  );
  const width = 250 * (Math.max(...levels.values()) + 1);
  const height = Math.max(120, Math.max(...rows.values()) * 85 + 20);
  return (
    <section aria-label={m.graph} className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{m.graph}</h2>
      <p className="text-sm text-muted-foreground">{m.graphHelp}</p>
      <div
        className="max-h-[520px] overflow-auto rounded-lg border p-2"
        tabIndex={0}
        role="region"
        aria-label={m.graph}
      >
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby={`${id}-graph-title`}
          className="text-foreground"
        >
          <title id={`${id}-graph-title`}>{m.graph}</title>
          <defs>
            <marker
              id={`${id}-prerequisite-arrow`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
            </marker>
          </defs>
          {concepts.flatMap((concept) =>
            concept.prerequisiteIds.map((parent) => {
              const start = positions.get(parent)!;
              const end = positions.get(concept.id)!;
              return (
                <path
                  key={`${parent}-${concept.id}`}
                  d={`M${start.x + 210},${start.y + 30} C${start.x + 235},${start.y + 30} ${end.x - 25},${end.y + 30} ${end.x},${end.y + 30}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  markerEnd={`url(#${id}-prerequisite-arrow)`}
                  opacity="0.5"
                />
              );
            }),
          )}
          {concepts.map((concept) => {
            const point = positions.get(concept.id)!;
            return (
              <g key={concept.id}>
                <title>{concept.title}</title>
                <rect
                  x={point.x}
                  y={point.y}
                  width="210"
                  height="60"
                  rx="8"
                  className="fill-card stroke-border"
                />
                <text
                  x={point.x + 12}
                  y={point.y + 34}
                  fill="currentColor"
                  fontSize="13"
                >
                  {concept.title.length > 26
                    ? `${concept.title.slice(0, 25)}…`
                    : concept.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {concepts.map((concept) => (
          <li key={concept.id} className="rounded-lg border p-4">
            <h3 className="font-medium break-words">{concept.title}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {concept.description}
            </p>
            <p className="mt-2 text-sm">
              {m.prerequisites}:{" "}
              {concept.prerequisiteIds.length
                ? concept.prerequisiteIds
                    .map((id) => byId.get(id)?.title)
                    .join(", ")
                : m.noPrerequisites}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
