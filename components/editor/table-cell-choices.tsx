"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { TextElement } from "@/types/presentation";

export function TableCellChoices({ element, choices, scale, onChoose, onCustom, onClose, onNavigate }: {
  element: TextElement; choices: string[]; scale: number;
  onChoose: (value: string) => void; onCustom: () => void; onClose: () => void; onNavigate: (direction: -1 | 1) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  useEffect(() => {
    const button = root.current?.querySelector<HTMLButtonElement>("button[aria-pressed=true]") ?? root.current?.querySelector<HTMLButtonElement>("button");
    button?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      ref={root} role="dialog" aria-label="Edit table cell"
      className="absolute z-40 w-44 space-y-1 rounded-xl border border-stroke-01 bg-surface-01 p-2 shadow-lg"
      style={{ left: Math.max(4, Math.min(element.x * scale, 1920 * scale - 180)), top: Math.max(4, Math.min((element.y + element.height) * scale + 4, 1080 * scale - 210)) }}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={(event) => { if (!leaving.current && !event.currentTarget.contains(event.relatedTarget)) onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); leaving.current = true; onClose(); }
        if (event.key === "Tab") { event.preventDefault(); event.stopPropagation(); leaving.current = true; onNavigate(event.shiftKey ? -1 : 1); }
      }}
    >
      {choices.map((choice) => <Button key={choice} className="w-full justify-start" variant={element.text === choice ? "subtle" : "ghost"} aria-pressed={element.text === choice} onClick={() => { leaving.current = true; onChoose(choice); }}>{choice === "✓" ? "✓ Included" : choice === "—" ? "— None" : choice}</Button>)}
      <div className="border-t border-stroke-01 pt-1"><Button className="w-full justify-start text-muted-foreground" variant="ghost" onClick={() => { leaving.current = true; onCustom(); }}>Custom text…</Button></div>
    </div>
  );
}
