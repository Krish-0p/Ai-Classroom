"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendRequest } from "@/lib/request";
import { tutorMessages as m } from "@/lib/tutor-messages";
export type LessonActivityContext = {
  classroomId: string;
  lessonId: string;
  version: number;
};
type EventType =
  | "lesson_started"
  | "lesson_completed"
  | "block_viewed"
  | "checkpoint_answered";
export function useLearningEvents(
  context: LessonActivityContext | undefined,
  blockId: string | undefined,
  finished: boolean,
) {
  const [error, setError] = useState("");
  const queue = useRef(Promise.resolve());
  const classroomId = context?.classroomId,
    lessonId = context?.lessonId,
    version = context?.version;
  const record = useCallback(
    (type: EventType, blockId?: string) => {
      if (!classroomId || !lessonId || !version) return;
      queue.current = queue.current.then(async () => {
        try {
          await sendRequest(`/api/classrooms/${classroomId}/events`, {
            type,
            lessonId,
            version,
            ...(blockId ? { blockId } : {}),
          });
        } catch {
          setError(m.eventError);
        }
      });
    },
    [classroomId, lessonId, version],
  );
  useEffect(() => {
    if (blockId) {
      record("lesson_started");
      record("block_viewed", blockId);
    } else if (finished) record("lesson_completed");
  }, [record, blockId, finished]);
  return { error, checkpoint: () => record("checkpoint_answered", blockId) };
}
