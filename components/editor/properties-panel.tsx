"use client";

import { Play } from "lucide-react";

import { CardProperties } from "@/components/editor/panels/card-properties";
import { ImageProperties } from "@/components/editor/panels/image-properties";
import { SlideProperties } from "@/components/editor/panels/slide-properties";
import { TextProperties } from "@/components/editor/panels/text-properties";
import { DisabledControl } from "@/components/editor/top-bar";
import { Button } from "@/components/ui/button";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";

export function PropertiesPanel() {
  const activeSlide = useEditorStore(selectActiveSlide);
  const selectedElementIds = useEditorStore(
    (state) => state.selectedElementIds,
  );
  const selectedElementId = selectedElementIds[0];
  const selectedElement = activeSlide?.elements.find(
    (element) => element.id === selectedElementId,
  );

  return (
    <aside className="absolute bottom-3 right-3 top-3 z-10 flex w-[280px] flex-col overflow-hidden rounded-[1.25rem] border border-stroke-01 bg-surface-01">
      <div className="flex items-center justify-between border-b border-stroke-01 p-3 pl-4">
        <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-primary">
          Properties
        </h2>
        <DisabledControl label="Present mode is available in a later phase">
          <Button disabled>
            <Play className="size-3.5 fill-current" />
            Present
          </Button>
        </DisabledControl>
      </div>

      {activeSlide && selectedElement?.component ? (
        <CardProperties
          component={selectedElement.component}
          key={selectedElement.component.instanceId}
          selectedElementIds={selectedElementIds}
          slide={activeSlide}
        />
      ) : null}

      {activeSlide && selectedElement?.type === "text" ? (
        <TextProperties
          element={selectedElement}
          key={selectedElement.id}
          slideId={activeSlide.id}
        />
      ) : activeSlide && selectedElement?.type === "image" ? (
        <ImageProperties
          element={selectedElement}
          key={selectedElement.id}
          slideId={activeSlide.id}
        />
      ) : selectedElement?.component ? null : (
        // The card section above already covers a selected card background.
        <SlideProperties />
      )}
    </aside>
  );
}
