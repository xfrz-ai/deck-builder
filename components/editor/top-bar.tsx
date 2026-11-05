"use client";

import { Download, LoaderCircle, Redo2, Undo2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { InsertToolbar } from "@/components/editor/insert-toolbar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { notifyEditor } from "@/lib/editor/notifications";
import { exportPresentationToPptx } from "@/lib/export/pptx-export";
import { useEditorStore } from "@/store/editor-store";

interface DisabledControlProps {
  label: string;
  children: ReactNode;
}

export function DisabledControl({ label, children }: DisabledControlProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar() {
  const [isExporting, setIsExporting] = useState(false);
  const presentation = useEditorStore((state) => state.presentation);
  const canUndo = useEditorStore((state) => state.undoStack.length > 0);
  const canRedo = useEditorStore((state) => state.redoStack.length > 0);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  const handleExport = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportPresentationToPptx(presentation);
      notifyEditor(
        result.missingImageCount > 0
          ? `${result.fileName} exported with ${result.missingImageCount} unavailable image placeholder${result.missingImageCount === 1 ? "" : "s"}.`
          : `${result.fileName} exported successfully.`,
        "info",
      );
    } catch {
      notifyEditor("PowerPoint export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header
      aria-label="Editor toolbar"
      className="flex items-center rounded-[1.25rem] border border-stroke-01 bg-surface-01 shadow-toolbar"
      role="toolbar"
    >
      <InsertToolbar />

      <div className="flex items-center gap-1 p-2">
        <DisabledControl
          label={canUndo ? "Undo (Ctrl/Cmd + Z)" : "Nothing to undo"}
        >
          <Button
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
            size="tool"
            variant="ghost"
          >
            <Undo2 className="size-[18px]" strokeWidth={1.8} />
            Undo
          </Button>
        </DisabledControl>
        <DisabledControl
          label={
            canRedo ? "Redo (Ctrl/Cmd + Shift + Z)" : "Nothing to redo"
          }
        >
          <Button
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
            size="tool"
            variant="ghost"
          >
            <Redo2 className="size-[18px]" strokeWidth={1.8} />
            Redo
          </Button>
        </DisabledControl>
      </div>

      <div className="p-2">
        <Button
          aria-busy={isExporting}
          aria-label="Export presentation as PowerPoint"
          disabled={isExporting}
          onClick={handleExport}
        >
          {isExporting ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin"
              strokeWidth={1.9}
            />
          ) : (
            <Download
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.9}
            />
          )}
          {isExporting ? "Exporting…" : "Export"}
        </Button>
      </div>
    </header>
  );
}
