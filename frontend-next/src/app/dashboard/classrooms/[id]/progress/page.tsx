import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageActor } from "@/server/session";
import { readProgress } from "@/server/mastery";
import { readClassroom } from "@/server/classrooms";
import { AppError } from "@/server/errors";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { assessmentMessages as m } from "@/lib/assessment-messages";

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (actor.role !== "student") redirect(`/dashboard/classrooms/${id}`);
  let classroom: Awaited<ReturnType<typeof readClassroom>>;
  let progress: Awaited<ReturnType<typeof readProgress>>;
  try {
    [classroom, progress] = await Promise.all([readClassroom(actor, id), readProgress(actor, id)]);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const withEvidence = progress.concepts.filter((concept) => concept.evidenceCount > 0);
  const average = withEvidence.length ? Math.round(withEvidence.reduce((sum, concept) => sum + concept.score, 0) / withEvidence.length * 100) : null;
  const needsReview = progress.concepts.filter((concept) => concept.state === "reviewNeeded" || concept.state === "developing").length;
  const pending = progress.attempts.filter((attempt) => attempt.pendingReview).length;
  return (
    <div className="learning-page learning-page-progress learning-page-student">
      <header className="learning-page-hero">
        <div><p className="learning-page-eyebrow">PRIVATE TO YOU <span>·</span> {classroom.name}</p><h1>{m.progress}</h1><p>{m.progressHelp} {m.noRanking}</p></div>
        <div className="learning-page-stat"><strong>{average === null ? "—" : `${average}%`}</strong><span>estimated mastery</span><strong>{withEvidence.length} / {progress.concepts.length}</strong><span>concepts practiced</span></div>
      </header>
      <div className="progress-overview-strip"><span className="progress-overview-mark" aria-hidden="true">↗</span><p>{pending ? `${pending} submitted ${pending === 1 ? "answer is" : "answers are"} waiting for teacher review and won't affect this estimate yet.` : m.pendingExcluded}</p><details><summary>{m.why}</summary><p>{m.masteryExplanation}</p></details></div>
      <section className="learning-list-section">
        <div className="learning-list-heading"><div><p className="learning-section-kicker">BUILT FROM YOUR PRACTICE</p><h2>Concept understanding</h2></div><span>{progress.concepts.length}</span></div>
        {!progress.concepts.length ? (
          <Empty className="learning-empty"><EmptyHeader><EmptyTitle>{m.noEvidence}</EmptyTitle><EmptyDescription>{m.emptyHelp}</EmptyDescription></EmptyHeader></Empty>
        ) : (
          <div className="progress-concept-grid">
            {progress.concepts.map((concept) => (
              <Card key={concept.id} className="progress-concept-card">
                <CardHeader className="progress-concept-header"><div><p className="learning-section-kicker">{concept.unit}</p><CardTitle><h3>{concept.title}</h3></CardTitle></div><Badge variant="secondary">{m[concept.state]}</Badge></CardHeader>
                <CardContent className="progress-concept-content">
                  <div className="mastery-score"><strong>{concept.evidenceCount ? `${Math.round(concept.score * 100)}%` : "—"}</strong><span>{m.mastery}</span></div>
                  <div className="mastery-meter" role="meter" aria-label={`${m.mastery}: ${concept.evidenceCount ? `${Math.round(concept.score * 100)}%` : "no evidence"}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={concept.evidenceCount ? Math.round(concept.score * 100) : 0}><span style={{ width: `${concept.evidenceCount ? Math.round(concept.score * 100) : 0}%` }} /></div>
                  <div className="progress-concept-meta"><span>{m.confidence} <strong>{Math.round(concept.confidence * 100)}%</strong></span><span>{m.evidence} <strong>{concept.evidenceCount}</strong></span><span>{m.distinct} <strong>{concept.explanation.distinctQuestions}</strong></span></div>
                  {concept.lessonId && <Link className="learning-inline-link" href={`/dashboard/classrooms/${id}/lessons/${concept.lessonId}`}>{m.reviewConcept} <span aria-hidden="true">→</span></Link>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {needsReview > 0 && <p className="progress-next-step">A useful next step: revisit one of the {needsReview} concepts marked for more practice, then try another assessment.</p>}
      </section>
      <section className="learning-list-section">
        <div className="learning-list-heading"><div><p className="learning-section-kicker">YOUR PRACTICE HISTORY</p><h2>{m.history}</h2></div><span>{progress.attempts.length}</span></div>
        {!progress.attempts.length ? <p className="learning-history-empty">{m.emptyAttempts}</p> : <ol className="learning-resource-list">{progress.attempts.map((attempt) => <li key={attempt.id} className="learning-resource-card learning-attempt-card"><span className="learning-resource-number">{String(attempt.number).padStart(2, "0")}</span><div className="learning-resource-main"><p className="learning-section-kicker">{m.attempt} {attempt.number}</p><h3>{attempt.submittedAt?.toLocaleDateString("en-IN", { timeZone: "UTC" }) ?? m.pending}</h3><p>{attempt.score.toFixed(2)} / {attempt.maximumScore} · {attempt.pendingReview ? m.pending : m.complete}</p></div><Link className="learning-inline-link" href={`/dashboard/classrooms/${id}/attempts/${attempt.id}`}>View feedback <span aria-hidden="true">→</span></Link></li>)}</ol>}
      </section>
    </div>
  );
}
