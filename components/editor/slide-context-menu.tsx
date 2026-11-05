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

interface SlideContextMenuProps {
  canDelete: boolean;
  children: ReactElement;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function SlideContextMenu({
  canDelete,
  children,
  onDelete,
  onDuplicate,
}: SlideContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onDuplicate}>
          <Copy className="size-3.5" strokeWidth={1.8} />
          Duplicate slide
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="focus:bg-[#fff1ee] focus:text-destructive"
          disabled={!canDelete}
          onSelect={onDelete}
        >
          <Trash2 className="size-3.5" strokeWidth={1.8} />
          Delete slide
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
