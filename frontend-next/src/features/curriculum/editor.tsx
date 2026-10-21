"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { curriculumSchema, type CurriculumInput } from "./schema";
import { KnowledgeGraph } from "@/features/knowledge-graph/graph";
import { curriculumMessages as m } from "@/lib/curriculum-messages";
import { sendRequest } from "@/lib/request";
import { messages } from "@/lib/messages";
import { SectionTabs } from "@/components/workspace/section-tabs";
import { workspaceMessages as w } from "@/lib/workspace-messages";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

type Props = {
  classroomId: string;
  initial: CurriculumInput | null;
  version: number;
  courseName: string;
  disabled: boolean;
  availableSources: { id: string; filename: string }[];
  initialSourceIds: string[];
};
const newConcept =
  (): CurriculumInput["units"][number]["concepts"][number] => ({
    id: `concept_${crypto.randomUUID().slice(0, 8)}`,
    title: "",
    description: "",
    prerequisiteIds: [],
  });
function reordered<T>(values: T[], index: number, delta: number) {
  const result = [...values];
  [result[index], result[index + delta]] = [
    result[index + delta],
    result[index],
  ];
  return result;
}
export function CurriculumEditor({
  classroomId,
  initial,
  version: initialVersion,
  courseName,
  disabled,
  availableSources,
  initialSourceIds,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<CurriculumInput>(
    initial ?? { courseTitle: courseName, learningOutcomes: [], units: [] },
  );
  const [outcomes, setOutcomes] = useState(
    (initial?.learningOutcomes ?? []).join("\n"),
  );
  const [version, setVersion] = useState(initialVersion);
  const [dirty, setDirty] = useState(!initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sourceIds, setSourceIds] = useState(initialSourceIds);
  function change(next: CurriculumInput) {
    setDraft(next);
    setDirty(true);
    setNotice("");
  }
  function unitChange(
    index: number,
    update: Partial<CurriculumInput["units"][number]>,
  ) {
    change({
      ...draft,
      units: draft.units.map((unit, i) =>
        i === index ? { ...unit, ...update } : unit,
      ),
    });
  }
  function conceptChange(
    unitIndex: number,
    index: number,
    update: Partial<CurriculumInput["units"][number]["concepts"][number]>,
  ) {
    unitChange(unitIndex, {
      concepts: draft.units[unitIndex].concepts.map((concept, i) =>
        i === index ? { ...concept, ...update } : concept,
      ),
    });
  }
  function removeConcepts(ids: string[], unitIndex?: number) {
    change({
      ...draft,
      units: draft.units
        .filter((_, i) => i !== unitIndex)
        .map((unit) => ({
          ...unit,
          concepts: unit.concepts
            .filter((concept) => !ids.includes(concept.id))
            .map((concept) => ({
              ...concept,
              prerequisiteIds: concept.prerequisiteIds.filter(
                (id) => !ids.includes(id),
              ),
            })),
        })),
    });
  }
  async function save() {
    const parsed = curriculumSchema.safeParse({
      ...draft,
      learningOutcomes: outcomes
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await sendRequest<{ draftVersion: number }>(
        `/api/classrooms/${classroomId}/curriculum`,
        { version, curriculum: parsed.data, sourceIds },
        "PUT",
      );
      setDraft(parsed.data);
      setVersion(response.draftVersion);
      setDirty(false);
      setNotice(m.saved);
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.serverError);
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    setBusy(true);
    setError("");
    try {
      await sendRequest(`/api/classrooms/${classroomId}/curriculum/approve`, {
        version,
      });
      setNotice(m.approvalDone);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : messages.serverError);
    } finally {
      setBusy(false);
    }
  }
  const graph = curriculumSchema.safeParse(draft);
  const allConcepts = draft.units.flatMap((unit) => unit.concepts);
  const locked = disabled || busy;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{m.draft}</h2>
        </CardTitle>
        <CardDescription>{m.draftHelp}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <SectionTabs
            outline
            label={w.courseOutline}
            sections={[
              {
                id: "details",
                label: w.courseDetails,
                content: (
                  <FieldGroup>
                    <FieldSet>
                      <FieldLegend variant="label">
                        {m.linkedSources}
                      </FieldLegend>
                      <p className="text-sm text-muted-foreground">
                        {m.linkedSourceHelp}
                      </p>
                      {availableSources.map((source) => (
                        <label
                          key={source.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            disabled={locked}
                            checked={sourceIds.includes(source.id)}
                            onChange={(event) => {
                              setSourceIds((previous) =>
                                event.target.checked
                                  ? [...previous, source.id]
                                  : previous.filter((id) => id !== source.id),
                              );
                              setDirty(true);
                            }}
                          />
                          {source.filename}
                        </label>
                      ))}
                    </FieldSet>
                    <Field>
                      <FieldLabel htmlFor="curriculum-title">
                        {m.courseTitle}
                      </FieldLabel>
                      <Input
                        disabled={locked}
                        id="curriculum-title"
                        value={draft.courseTitle}
                        maxLength={160}
                        onChange={(event) =>
                          change({ ...draft, courseTitle: event.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="curriculum-outcomes">
                        {m.outcomes}
                      </FieldLabel>
                      <Textarea
                        disabled={locked}
                        id="curriculum-outcomes"
                        value={outcomes}
                        onChange={(event) => {
                          setOutcomes(event.target.value);
                          setDirty(true);
                        }}
                      />
                    </Field>
                  </FieldGroup>
                ),
              },
              ...draft.units.map((unit, unitIndex) => ({
                id: unit.id,
                label: unit.title || `${m.unit} ${unitIndex + 1}`,
                content: (
                  <FieldSet key={unit.id} className="rounded-lg border p-4">
                    <FieldLegend>
                      {m.unit} {unitIndex + 1}
                    </FieldLegend>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={locked || unitIndex === 0}
                        onClick={() =>
                          change({
                            ...draft,
                            units: reordered(draft.units, unitIndex, -1),
                          })
                        }
                      >
                        {m.up}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          locked || unitIndex === draft.units.length - 1
                        }
                        onClick={() =>
                          change({
                            ...draft,
                            units: reordered(draft.units, unitIndex, 1),
                          })
                        }
                      >
                        {m.down}
                      </Button>
                      <Button
                        disabled={locked}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          removeConcepts(
                            unit.concepts.map((concept) => concept.id),
                            unitIndex,
                          )
                        }
                      >
                        {m.remove} {m.unit.toLowerCase()}
                      </Button>
                    </div>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor={`unit-${unit.id}`}>
                          {m.unit} {m.courseTitle.toLowerCase()}
                        </FieldLabel>
                        <Input
                          disabled={locked}
                          id={`unit-${unit.id}`}
                          value={unit.title}
                          maxLength={160}
                          onChange={(event) =>
                            unitChange(unitIndex, { title: event.target.value })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`description-${unit.id}`}>
                          {m.description}
                        </FieldLabel>
                        <Textarea
                          disabled={locked}
                          id={`description-${unit.id}`}
                          value={unit.description}
                          maxLength={2000}
                          onChange={(event) =>
                            unitChange(unitIndex, {
                              description: event.target.value,
                            })
                          }
                        />
                      </Field>
                    </FieldGroup>
                    <Accordion
                      defaultValue={
                        unit.concepts[0] ? [unit.concepts[0].id] : []
                      }
                    >
                      {unit.concepts.map((concept, index) => (
                        <AccordionItem key={concept.id} value={concept.id}>
                          <AccordionTrigger>
                            {index + 1}. {concept.title || m.concept}
                          </AccordionTrigger>
                          <AccordionContent>
                            <FieldSet
                              key={concept.id}
                              className="rounded-lg border p-4"
                            >
                              <FieldLegend>
                                {m.concept} {index + 1}
                              </FieldLegend>
                              <FieldGroup>
                                <Field>
                                  <FieldLabel htmlFor={`concept-${concept.id}`}>
                                    {m.concept} {m.courseTitle.toLowerCase()}
                                  </FieldLabel>
                                  <Input
                                    disabled={locked}
                                    id={`concept-${concept.id}`}
                                    value={concept.title}
                                    maxLength={160}
                                    onChange={(event) =>
                                      conceptChange(unitIndex, index, {
                                        title: event.target.value,
                                      })
                                    }
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel
                                    htmlFor={`description-${concept.id}`}
                                  >
                                    {m.description}
                                  </FieldLabel>
                                  <Textarea
                                    disabled={locked}
                                    id={`description-${concept.id}`}
                                    value={concept.description}
                                    maxLength={2000}
                                    onChange={(event) =>
                                      conceptChange(unitIndex, index, {
                                        description: event.target.value,
                                      })
                                    }
                                  />
                                </Field>
                              </FieldGroup>
                              <FieldSet>
                                <FieldLegend variant="label">
                                  {m.prerequisites}
                                </FieldLegend>
                                <div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">
                                  {allConcepts
                                    .filter(
                                      (candidate) =>
                                        candidate.id !== concept.id,
                                    )
                                    .map((candidate) => (
                                      <label
                                        key={candidate.id}
                                        className="flex items-center gap-2 text-sm"
                                      >
                                        <input
                                          type="checkbox"
                                          disabled={locked}
                                          checked={concept.prerequisiteIds.includes(
                                            candidate.id,
                                          )}
                                          onChange={(event) =>
                                            conceptChange(unitIndex, index, {
                                              prerequisiteIds: event.target
                                                .checked
                                                ? [
                                                    ...concept.prerequisiteIds,
                                                    candidate.id,
                                                  ]
                                                : concept.prerequisiteIds.filter(
                                                    (id) => id !== candidate.id,
                                                  ),
                                            })
                                          }
                                        />
                                        {candidate.title || m.concept}
                                      </label>
                                    ))}
                                  {allConcepts.length < 2 && (
                                    <p className="text-sm text-muted-foreground">
                                      {m.noPrerequisites}
                                    </p>
                                  )}
                                </div>
                              </FieldSet>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={locked || index === 0}
                                  onClick={() =>
                                    unitChange(unitIndex, {
                                      concepts: reordered(
                                        unit.concepts,
                                        index,
                                        -1,
                                      ),
                                    })
                                  }
                                >
                                  {m.up}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    locked || index === unit.concepts.length - 1
                                  }
                                  onClick={() =>
                                    unitChange(unitIndex, {
                                      concepts: reordered(
                                        unit.concepts,
                                        index,
                                        1,
                                      ),
                                    })
                                  }
                                >
                                  {m.down}
                                </Button>
                                <Button
                                  disabled={locked}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeConcepts([concept.id])}
                                >
                                  {m.remove} {m.concept.toLowerCase()}
                                </Button>
                              </div>
                            </FieldSet>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={locked || unit.concepts.length >= 50}
                      onClick={() =>
                        unitChange(unitIndex, {
                          concepts: [...unit.concepts, newConcept()],
                        })
                      }
                    >
                      {m.addConcept}
                    </Button>
                  </FieldSet>
                ),
              })),
            ]}
          />
          <Button
            type="button"
            variant="outline"
            disabled={locked || draft.units.length >= 20}
            onClick={() =>
              change({
                ...draft,
                units: [
                  ...draft.units,
                  {
                    id: `unit_${crypto.randomUUID().slice(0, 8)}`,
                    title: "",
                    description: "",
                    concepts: [newConcept()],
                  },
                ],
              })
            }
          >
            {m.addUnit}
          </Button>
          <fieldset disabled={locked} className="workspace-save-bar">
            <p role="status">{dirty ? w.unsaved : w.saved}</p>
            <Button type="button" onClick={save}>
              {busy ? messages.working : m.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={dirty || !version}
              onClick={approve}
            >
              {m.approve}
            </Button>
          </fieldset>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription role="alert">{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {graph.success && (
          <Accordion>
            <AccordionItem value="map">
              <AccordionTrigger>{w.knowledgeMap}</AccordionTrigger>
              <AccordionContent>
                <KnowledgeGraph curriculum={graph.data} id="draft" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
