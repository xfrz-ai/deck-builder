"use client";

import { Redo2, Undo2, Upload } from "lucide-react";
import { type ReactNode, useState } from "react";

import { ImportDeckDialog, type ImportDeckMode } from "@/components/editor/import-deck-dialog";
import { InsertToolbar } from "@/components/editor/insert-toolbar";
import { LocalDeckControls } from "@/components/editor/local-deck-session";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { notifyEditor } from "@/lib/editor/notifications";
import { useEditorStore } from "@/store/editor-store";
import type { Presentation } from "@/types/presentation";

// Hidden for now; undo/redo still work with Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z.
const SHOW_UNDO_REDO_BUTTONS = false;

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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const canUndo = useEditorStore((state) => state.undoStack.length > 0);
  const canRedo = useEditorStore((state) => state.redoStack.length > 0);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const importDeck = useEditorStore((state) => state.importDeck);

  const handleImport = (presentation: Presentation, mode: ImportDeckMode) => {
    const intoCurrent = mode === "append" ? "append" : "replace";
    const count = presentation.slides.length;
    importDeck(presentation, intoCurrent);
    notifyEditor(
      `${intoCurrent === "replace" ? "Deck replaced with" : "Added"} ${count} slide${count === 1 ? "" : "s"}. Press Cmd/Ctrl+Z to undo.`,
      "info",
    );
  };

  return (
    <>
    <header
      aria-label="Editor toolbar"
      className="flex items-center rounded-[1.25rem] border border-stroke-01 bg-surface-01 shadow-toolbar"
      role="toolbar"
    >
      <InsertToolbar />

      {SHOW_UNDO_REDO_BUTTONS ? (
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
      ) : null}

      <div className="flex items-center gap-1 p-2">
        <DisabledControl label="Build slides from a deck spec (JSON)">
          <Button
            aria-label="Import deck spec"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload aria-hidden="true" className="size-4" strokeWidth={1.9} />
            Import
          </Button>
        </DisabledControl>
      </div>

      {isImportOpen ? <ImportDeckDialog onClose={() => setIsImportOpen(false)} onImport={handleImport} /> : null}
    </header>
    <LocalDeckControls />
    </>
  );
}
