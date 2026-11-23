"use client";

import { ArrowLeft, FileQuestion, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EditorShell } from "@/components/editor/editor-shell";
import { buttonVariants } from "@/components/ui/button";
import { notifyEditor } from "@/lib/editor/notifications";
import { loadDeck, saveDeck, type DeckRecord } from "@/lib/presentation/library";
import { EditorStoreProvider, useEditorStore } from "@/store/editor-store";

const AUTOSAVE_DELAY_MS = 500;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; record: DeckRecord }
  | { status: "missing" }
  | { status: "error"; message: string };

// Opens a presentation from the browser library. Without an id there is
// nothing to open, so it returns to the home page.
export function LibraryDeckEntry({ deckId }: { deckId: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!deckId) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    loadDeck(deckId).then(
      (record) => {
        if (!cancelled) setState(record ? { status: "ready", record } : { status: "missing" });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "The presentation could not be opened.",
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [deckId, router]);

  if (state.status === "ready") {
    return (
      <EditorStoreProvider initialPresentation={state.record.presentation} persistent={false}>
        <LibraryAutosave deckId={state.record.id} initialActiveSlideId={state.record.activeSlideId} />
        <EditorShell />
      </EditorStoreProvider>
    );
  }

  if (state.status === "loading") {
    return (
      <main aria-busy="true" className="flex min-h-dvh items-center justify-center bg-surface-02">
        <LoaderCircle aria-label="Opening presentation" className="size-5 animate-spin text-muted-foreground" strokeWidth={1.8} />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-02 px-6 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-stroke-01 bg-surface-01 text-primary shadow-toolbar">
          <FileQuestion aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </div>
        <h1 className="text-xl font-medium tracking-[-0.03em] text-primary">
          {state.status === "missing" ? "Presentation not found" : "Couldn't open this presentation"}
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
          {state.status === "missing"
            ? "It may have been deleted, or it was saved in a different browser."
            : state.message}
        </p>
        <Link className={buttonVariants({ className: "mt-6" })} href="/">
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.9} />
          All presentations
        </Link>
      </div>
    </main>
  );
}

// Writes the open presentation back to the library shortly after each change,
// and right away when the editor closes. Moving between slides is remembered
// without counting as an edit.
function LibraryAutosave({ deckId, initialActiveSlideId }: { deckId: string; initialActiveSlideId: string }) {
  const presentation = useEditorStore((state) => state.presentation);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const selectSlide = useEditorStore((state) => state.selectSlide);
  const saved = useRef({ presentation, activeSlideId: initialActiveSlideId });
  const pendingEdit = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => undefined);

  // Reopen on the slide that was active last time.
  useEffect(() => {
    selectSlide(initialActiveSlideId);
  }, [initialActiveSlideId, selectSlide]);

  useEffect(() => {
    const edited = presentation !== saved.current.presentation;
    if (!edited && activeSlideId === saved.current.activeSlideId) return;
    pendingEdit.current ||= edited;

    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      flushRef.current = () => undefined;
      const touch = pendingEdit.current;
      pendingEdit.current = false;
      saved.current = { presentation, activeSlideId };
      saveDeck(deckId, presentation, activeSlideId, { touch }).catch(() => {
        notifyEditor("Changes could not be saved to this browser.");
      });
    };

    flushRef.current = flush;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  }, [deckId, presentation, activeSlideId]);

  useEffect(() => {
    const flush = () => flushRef.current();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return null;
}
