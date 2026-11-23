"use client";

import { CloudUpload, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { dismissBrowserDecks, listUnmovedBrowserDecks, moveBrowserDecksToCloud } from "@/lib/cloud/cloud-library";
import { notifyEditor } from "@/lib/editor/notifications";
import type { DeckSummary } from "@/lib/presentation/deck-library";

// Offers to copy presentations saved in this browser (before cloud storage)
// into the signed-in account. The browser copies stay where they are.
export function MoveToCloudBanner({ onMoved }: { onMoved: () => void }) {
  const [pending, setPending] = useState<DeckSummary[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let active = true;
    listUnmovedBrowserDecks().then((decks) => active && setPending(decks));
    return () => {
      active = false;
    };
  }, []);

  if (pending.length === 0) return null;

  const count = pending.length;
  const label = `${count} ${count === 1 ? "presentation is" : "presentations are"}`;

  const move = async () => {
    setProgress({ done: 0, total: count });
    try {
      const moved = await moveBrowserDecksToCloud((done, total) => setProgress({ done, total }));
      notifyEditor(`Moved ${moved} ${moved === 1 ? "presentation" : "presentations"} to your account.`, "info");
    } catch (error) {
      notifyEditor(error instanceof Error ? error.message : "Some presentations could not be moved. Try again.");
    }
    setProgress(null);
    setPending(await listUnmovedBrowserDecks());
    onMoved();
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-stroke-01 bg-surface-01 p-4" role="region" aria-label="Presentations in this browser">
      <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-03 text-primary">
        <CloudUpload className="size-4" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-primary">{label} saved only in this browser</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Move them to your account to open them anywhere and share them with the team. A copy stays in this browser.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button disabled={progress !== null} onClick={() => {
          dismissBrowserDecks(pending.map((deck) => deck.id));
          setPending([]);
        }} size="sm" variant="ghost">
          Not now
        </Button>
        <Button aria-busy={progress !== null} disabled={progress !== null} onClick={() => void move()} size="sm">
          {progress ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" strokeWidth={1.9} /> : null}
          {progress ? `Moving ${progress.done}/${progress.total}…` : "Move to my account"}
        </Button>
      </div>
    </div>
  );
}
