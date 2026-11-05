"use client";

import { Copy, Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditorStore } from "@/store/editor-store";

export function ElementContextMenu({ children }: { children: ReactElement }) {
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const selectedElementIds = useEditorStore(
    (state) => state.selectedElementIds,
  );
  const selectedElementId = selectedElementIds[0];
  const duplicateElement = useEditorStore(
    (state) => state.duplicateElement,
  );
  const deleteElements = useEditorStore((state) => state.deleteElements);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label="Element actions">
        <ContextMenuItem
          disabled={!selectedElementId}
          onSelect={() => {
            if (selectedElementId) {
              duplicateElement(activeSlideId, selectedElementId);
            }
          }}
        >
          <Copy className="size-3.5" strokeWidth={1.8} />
          Duplicate
          <span className="ml-auto text-[10px] text-muted-foreground">
            ⌘/Ctrl D
          </span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="focus:bg-red-50 focus:text-red-700"
          disabled={!selectedElementId}
          onSelect={() => {
            deleteElements(activeSlideId, selectedElementIds);
          }}
        >
          <Trash2 className="size-3.5" strokeWidth={1.8} />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
