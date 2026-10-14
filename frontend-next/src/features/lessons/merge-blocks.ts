import type { LessonBlockInput } from "./schema";
// Keep locked blocks in their relative positions while replacing unlocked content.
export function mergeLockedBlocks(
  existing: LessonBlockInput[],
  generated: LessonBlockInput[],
): LessonBlockInput[] {
  let index = 0;
  const merged: LessonBlockInput[] = [];
  for (const block of existing) {
    if (block.locked) merged.push(block);
    else if (generated[index]) merged.push(generated[index++]);
  }
  return [...merged, ...generated.slice(index)];
}
