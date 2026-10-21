"use client";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Maximize, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { SlideDeckInput } from "./schema";
import { slideMessages as m } from "@/lib/slide-messages";

export function SlidePlayer({
  deck,
  concepts,
}: {
  deck: SlideDeckInput;
  concepts: { id: string; title: string }[];
}) {
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const surface = useRef<HTMLDivElement>(null);
  const active = Math.min(index, deck.slides.length - 1);
  const labels = new Map(
    concepts.map((concept) => [concept.id, concept.title]),
  );
  return (
    <div ref={surface} className="slide-player">
      <div className="slide-player-toolbar">
        <p className="text-sm text-muted-foreground">
          {m.slide} {active + 1} {m.of} {deck.slides.length}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              if (!surface.current?.requestFullscreen)
                throw new Error(m.fullScreenError);
              await surface.current.requestFullscreen();
              setError("");
            } catch {
              setError(m.fullScreenError);
            }
          }}
        >
          <Maximize data-icon="inline-start" />
          {m.fullScreen}
        </Button>
      </div>
      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Tabs
        value={active}
        onValueChange={(value) => {
          if (typeof value === "number") setIndex(value);
        }}
      >
        <TabsList className="max-w-full overflow-x-auto" aria-label={m.preview}>
          {deck.slides.map((slide, position) => (
            <TabsTrigger
              key={position}
              value={position}
              aria-label={`${m.slide} ${position + 1}: ${slide.heading}`}
            >
              {String(position + 1).padStart(2, "0")}
            </TabsTrigger>
          ))}
        </TabsList>
        {deck.slides.map((slide, position) => (
          <TabsContent value={position} key={position}>
            <article
              className="slide-canvas"
              aria-label={`${m.slide} ${position + 1}`}
            >
              <header className="slide-canvas-header">
                <span>{deck.title}</span>
                <span aria-hidden="true">
                  {String(position + 1).padStart(2, "0")} /{" "}
                  {String(deck.slides.length).padStart(2, "0")}
                </span>
              </header>
              <div className="slide-canvas-main">
                <div className="slide-canvas-copy">
                  <h2>{slide.heading}</h2>
                  <p>{slide.explanation}</p>
                  <ul>
                    {slide.bullets.map((point, pointIndex) => (
                      <li key={pointIndex}>
                        <span aria-hidden="true">
                          {String(pointIndex + 1).padStart(2, "0")}
                        </span>
                        <p>{point}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                {slide.example && (
                  <aside className="slide-example">
                    <Lightbulb aria-hidden="true" />
                    <h3>{m.exampleLabel}</h3>
                    <p>{slide.example}</p>
                  </aside>
                )}
              </div>
              <footer className="slide-takeaway">
                <p>{m.takeawayLabel}</p>
                <strong>{slide.takeaway}</strong>
              </footer>
            </article>
            {!!slide.conceptIds.length && (
              <div
                className="flex flex-wrap gap-2 py-3"
                aria-label={m.concepts}
              >
                {slide.conceptIds.map((id) => (
                  <Badge variant="secondary" key={id}>
                    {labels.get(id) ?? id}
                  </Badge>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <div className="slide-player-toolbar">
        <Button
          variant="outline"
          disabled={active === 0}
          onClick={() => setIndex(active - 1)}
        >
          <ArrowLeft data-icon="inline-start" />
          {m.previous}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {deck.slides[active]?.heading}
        </p>
        <Button
          disabled={active === deck.slides.length - 1}
          onClick={() => setIndex(active + 1)}
        >
          {m.next}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
