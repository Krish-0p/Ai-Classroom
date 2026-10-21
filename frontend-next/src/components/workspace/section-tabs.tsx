"use client";
import { useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { workspaceMessages as w } from "@/lib/workspace-messages";

export type WorkspaceSection = {
  id: string;
  label: string;
  content: ReactNode;
};
export function SectionTabs({
  sections,
  label,
  defaultValue,
  outline = false,
  sequential = false,
  disabledContent = false,
}: {
  sections: WorkspaceSection[];
  label: string;
  defaultValue?: string;
  outline?: boolean;
  sequential?: boolean;
  disabledContent?: boolean;
}) {
  const [selected, setSelected] = useState(defaultValue ?? sections[0]?.id);
  const value = sections.some((section) => section.id === selected)
    ? selected
    : sections[0]?.id;
  return (
    <Tabs
      value={value}
      onValueChange={(value) => setSelected(String(value))}
      orientation={outline ? "vertical" : "horizontal"}
      className={cn("workspace-tabs", outline && "workspace-outline-tabs")}
    >
      <TabsList
        variant="line"
        aria-label={label}
        className="workspace-tab-list"
      >
        {sections.map((section, index) => (
          <TabsTrigger key={section.id} value={section.id}>
            {outline && (
              <span className="outline-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
            )}
            <span>{section.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="workspace-tab-panels">
        {sections.map((section) => (
          <TabsContent key={section.id} value={section.id} keepMounted>
            <fieldset disabled={disabledContent} className="min-w-0">
              {section.content}
            </fieldset>
          </TabsContent>
        ))}
        {sequential && value && (
          <div className="workspace-sequence-actions">
            <Button
              variant="outline"
              disabled={
                sections.findIndex((section) => section.id === value) === 0
              }
              onClick={() =>
                setSelected(
                  sections[
                    sections.findIndex((section) => section.id === value) - 1
                  ]?.id,
                )
              }
            >
              <ArrowLeft data-icon="inline-start" />
              {w.previous}
            </Button>
            <Button
              variant="outline"
              disabled={
                sections.findIndex((section) => section.id === value) ===
                sections.length - 1
              }
              onClick={() =>
                setSelected(
                  sections[
                    sections.findIndex((section) => section.id === value) + 1
                  ]?.id,
                )
              }
            >
              {w.next}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        )}
      </div>
    </Tabs>
  );
}
