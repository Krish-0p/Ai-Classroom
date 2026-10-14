import "server-only";
import { getDatabase } from "@/db/client";
import type { Actor } from "@/features/auth/schema";
import {
  WeightedMasteryStrategy,
  type MasteryEvidence,
} from "@/features/mastery/strategy";
import { publishedAssessmentSchema } from "@/features/assessments/schema";
import { ownedClassroom } from "./curriculum-access";
import { readTutorReports } from "./tutor";
export async function readAnalytics(actor: Actor, classroomId: string) {
  await ownedClassroom(actor, classroomId, false);
  const db = getDatabase();
  const [
    enrollments,
    concepts,
    attempts,
    events,
    completions,
    lessons,
    reports,
  ] = await Promise.all([
    db.enrollment.findMany({
      where: { classroomId },
      select: { student: { select: { id: true, name: true } } },
    }),
    db.concept.findMany({
      where: { classroomId },
      orderBy: [{ unit: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        title: true,
        prerequisites: { select: { prerequisiteConceptId: true } },
      },
    }),
    db.attempt.findMany({
      where: {
        submittedAt: { not: null },
        student: { enrollments: { some: { classroomId } } },
        assessment: { classroomId, classroom: { teacherId: actor.id } },
      },
      select: {
        id: true,
        assessmentId: true,
        assessmentVersion: true,
        studentId: true,
        number: true,
        submittedAt: true,
        score: true,
        maximumScore: true,
        pendingReview: true,
        snapshot: true,
        questions: {
          select: {
            questionKey: true,
            conceptIds: true,
            difficulty: true,
            hintsUsed: true,
            marks: true,
            maximumMarks: true,
            needsReview: true,
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    }),
    db.learningEvent.groupBy({
      by: ["type"],
      where: {
        classroomId,
        createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
        user: { role: "student", enrollments: { some: { classroomId } } },
      },
      _count: true,
    }),
    db.learningEvent.findMany({
      where: {
        classroomId,
        type: "lesson_completed",
        user: { enrollments: { some: { classroomId } } },
      },
      select: { dedupeKey: true, resourceId: true },
    }),
    db.lesson.findMany({
      where: { classroomId, status: "published" },
      select: { id: true, publishedVersion: true },
    }),
    readTutorReports(actor, classroomId),
  ]);
  const strategy = new WeightedMasteryStrategy();
  const evidence = new Map<string, Map<string, MasteryEvidence[]>>();
  const questions = new Map<
    string,
    {
      assessmentId: string;
      title: string;
      prompt: string;
      responses: number;
      errors: number;
    }
  >();
  const trends = new Map<
    string,
    {
      assessmentId: string;
      version: number;
      title: string;
      submissions: number;
      pending: number;
      students: Set<string>;
      scores: number[];
    }
  >();
  for (const attempt of attempts) {
    const document = publishedAssessmentSchema.parse(attempt.snapshot);
    const trendKey = `${attempt.assessmentId}:${attempt.assessmentVersion}`;
    const trend = trends.get(trendKey) ?? {
      assessmentId: attempt.assessmentId,
      version: attempt.assessmentVersion,
      title: document.title,
      submissions: 0,
      pending: 0,
      students: new Set<string>(),
      scores: [],
    };
    trend.submissions++;
    trend.students.add(attempt.studentId);
    if (attempt.pendingReview) trend.pending++;
    else trend.scores.push(attempt.score / attempt.maximumScore);
    trends.set(trendKey, trend);
    for (const question of attempt.questions) {
      if (question.needsReview || question.marks === null) continue;
      const accuracy = question.marks / question.maximumMarks;
      const key = `${trendKey}:${question.questionKey}`;
      const missed = questions.get(key) ?? {
        assessmentId: attempt.assessmentId,
        title: document.title,
        prompt:
          document.questions.find((q) => q.id === question.questionKey)
            ?.prompt ?? "",
        responses: 0,
        errors: 0,
      };
      missed.responses++;
      if (accuracy < 1) missed.errors++;
      questions.set(key, missed);
      for (const conceptId of question.conceptIds) {
        const students =
          evidence.get(conceptId) ?? new Map<string, MasteryEvidence[]>();
        const items = students.get(attempt.studentId) ?? [];
        items.push({
          accuracy,
          difficulty: question.difficulty,
          hintsUsed: question.hintsUsed,
          attemptNumber: attempt.number,
          questionIdentity: `${attempt.assessmentId}:${question.questionKey}`,
          observedAt: attempt.submittedAt!,
        });
        students.set(attempt.studentId, items);
        evidence.set(conceptId, students);
      }
    }
  }
  const attention = new Map<string, string[]>();
  const conceptResults = concepts.map((concept) => {
    const students =
      evidence.get(concept.id) ?? new Map<string, MasteryEvidence[]>();
    const estimates = [...students].map(([studentId, items]) => ({
      studentId,
      ...strategy.evaluate(items),
    }));
    const allEvidence = [...students.values()].flat();
    const distribution = {
      noEvidence: enrollments.length - estimates.length,
      insufficient: 0,
      developing: 0,
      secure: 0,
      reviewNeeded: 0,
    };
    for (const estimate of estimates) {
      distribution[estimate.state]++;
      if (estimate.state === "reviewNeeded") {
        const weak = attention.get(estimate.studentId) ?? [];
        weak.push(concept.title);
        attention.set(estimate.studentId, weak);
      }
    }
    return {
      id: concept.id,
      title: concept.title,
      prerequisiteIds: concept.prerequisites.map(
        (p) => p.prerequisiteConceptId,
      ),
      coverage: estimates.length,
      average: estimates.length
        ? estimates.reduce((sum, e) => sum + e.score, 0) / estimates.length
        : null,
      confidence: estimates.length
        ? estimates.reduce((sum, e) => sum + e.confidence, 0) / estimates.length
        : null,
      distribution,
      evidenceCount: allEvidence.length,
      errorRate: allEvidence.length
        ? allEvidence.filter((e) => e.accuracy < 1).length / allEvidence.length
        : null,
      hintRate: allEvidence.length
        ? allEvidence.filter((e) => e.hintsUsed > 0).length / allEvidence.length
        : null,
    };
  });
  const currentCompletionKeys = new Set(
    lessons.map(
      (lesson) => `lesson_completed:${lesson.id}:${lesson.publishedVersion}:`,
    ),
  );
  return {
    enrolled: enrollments.length,
    submissions: attempts.length,
    pending: attempts.filter((a) => a.pendingReview).length,
    completed: completions.filter((event) =>
      currentCompletionKeys.has(event.dedupeKey),
    ).length,
    events: events.map((event) => ({ type: event.type, count: event._count })),
    concepts: conceptResults,
    attention: enrollments
      .filter((e) => attention.has(e.student.id))
      .map((e) => ({
        name: e.student.name,
        concepts: attention.get(e.student.id)!,
      })),
    missed: [...questions]
      .filter(([, value]) => value.errors > 0)
      .sort((a, b) => b[1].errors - a[1].errors)
      .slice(0, 20)
      .map(([key, value]) => ({ key, ...value })),
    trends: [...trends.values()].map((trend) => ({
      assessmentId: trend.assessmentId,
      title: trend.title,
      version: trend.version,
      submissions: trend.submissions,
      pending: trend.pending,
      students: trend.students.size,
      averageScore: trend.scores.length
        ? trend.scores.reduce((sum, score) => sum + score, 0) /
          trend.scores.length
        : null,
    })),
    reports,
  };
}
export type AnalyticsView = Awaited<ReturnType<typeof readAnalytics>>;
