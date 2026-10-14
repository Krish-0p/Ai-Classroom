export type MasteryEvidence = {
  accuracy: number;
  difficulty: string;
  hintsUsed: number;
  attemptNumber: number;
  questionIdentity: string;
  observedAt: Date;
};
export interface MasteryStrategy {
  evaluate(evidence: MasteryEvidence[], now?: Date): MasteryEstimate;
}
export type MasteryEstimate = {
  score: number;
  confidence: number;
  evidenceCount: number;
  state:
    "noEvidence" | "insufficient" | "developing" | "secure" | "reviewNeeded";
  explanation: {
    strategy: string;
    distinctQuestions: number;
    effectiveWeight: number;
    hintedResponses: number;
    repeatResponses: number;
    halfLifeDays: number;
    priorWeight: number;
  };
};
export class WeightedMasteryStrategy implements MasteryStrategy {
  evaluate(evidence: MasteryEvidence[], now = new Date()): MasteryEstimate {
    let weighted = 0,
      weight = 0;
    for (const item of evidence) {
      const days = Math.max(
        0,
        (now.getTime() - item.observedAt.getTime()) / 86_400_000,
      );
      const difficulty =
        item.difficulty === "hard" ? 1.2 : item.difficulty === "easy" ? 0.8 : 1;
      const independence =
        (item.hintsUsed ? 0.65 : 1) / Math.max(1, item.attemptNumber);
      const current = difficulty * independence * Math.pow(0.5, days / 90);
      weight += current;
      weighted += Math.max(0, Math.min(1, item.accuracy)) * current;
    }
    const distinct = new Set(evidence.map((item) => item.questionIdentity))
      .size;
    const score = (1 + weighted) / (2 + weight);
    const confidence = Math.min(
      0.95,
      (1 - Math.exp(-weight / 5)) * Math.min(1, distinct / 3),
    );
    const state = !evidence.length
      ? "noEvidence"
      : distinct < 3
        ? "insufficient"
        : score >= 0.8 && confidence >= 0.6
          ? "secure"
          : score < 0.55 && confidence >= 0.35
            ? "reviewNeeded"
            : "developing";
    return {
      score,
      confidence,
      evidenceCount: evidence.length,
      state,
      explanation: {
        strategy: "weighted-v1",
        distinctQuestions: distinct,
        effectiveWeight: weight,
        hintedResponses: evidence.filter((item) => item.hintsUsed > 0).length,
        repeatResponses: evidence.filter((item) => item.attemptNumber > 1)
          .length,
        halfLifeDays: 90,
        priorWeight: 2,
      },
    };
  }
}
