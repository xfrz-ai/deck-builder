"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorShell } from "@/components/editor/editor-shell";
import { LibraryDeckEntry } from "@/components/editor/library-deck-entry";
import { LocalDeckSession } from "@/components/editor/local-deck-session";
import { ClientSlideRenderer } from "@/components/editor/client-slide-renderer";
import type { DeckSnapshot } from "@/lib/deck-service/deck-document";
import { loadLocalDeck, localRequest, readBrowserConnection, rememberConnection, type BrowserConnection } from "@/lib/local-deck/client";
import { EDITOR_STORAGE_KEY } from "@/lib/presentation/persistence";
import { EditorStoreProvider } from "@/store/editor-store";

// Render inside <Suspense>: search params are only known in the browser.
export function EditorEntry({ preview = false }: { preview?: boolean }) {
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deckId");
  if (!deckId) {
    if (preview) return <main className="p-8">Open the preview URL returned by preview_deck.</main>;
    // Presentations saved in this browser; see lib/presentation/library.ts.
    const presentationId = searchParams.get("presentation");
    return <LibraryDeckEntry key={presentationId ?? ""} deckId={presentationId} />;
  }
  return <LocalDeckEntry key={deckId} deckId={deckId} preview={preview} follow={searchParams.get("follow") === "1"} />;
}

function LocalDeckEntry({ deckId, preview, follow }: { deckId: string; preview: boolean; follow: boolean }) {
  const [loaded, setLoaded] = useState<{ document: DeckSnapshot; connection: BrowserConnection } | null>(null);
  const [message, setMessage] = useState("");
  const [serviceUrl, setServiceUrl] = useState("http://127.0.0.1:8790");
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(true);

  async function connect(connection: BrowserConnection) {
    setConnecting(true); setMessage("");
    try {
      // Read-only access to the old key. Its complete value is backed up before local editing.
      const raw = window.localStorage.getItem(EDITOR_STORAGE_KEY);
      if (raw !== null) await localRequest(connection, "/backups", "POST", { raw });
      const document = await loadLocalDeck(connection, deckId);
      setLoaded({ document, connection });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not open local deck."); }
    finally { setConnecting(false); }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) throw new Error("Open local decks from the local editor.");
        const connection = readBrowserConnection();
        if (!connection) { if (!cancelled) setConnecting(false); return; }
        const raw = window.localStorage.getItem(EDITOR_STORAGE_KEY);
        if (raw !== null) await localRequest(connection, "/backups", "POST", { raw });
        const document = await loadLocalDeck(connection, deckId);
        if (!cancelled) setLoaded({ document, connection });
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Could not open local deck."); }
      finally { if (!cancelled) setConnecting(false); }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [deckId]);

  if (!loaded) return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-02 p-8 text-primary">
      <form className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-stroke-01 bg-surface-01 p-6" onSubmit={event => {
        event.preventDefault();
        try { void connect(rememberConnection(serviceUrl, token)); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Invalid connection."); }
      }}>
        <h1 className="text-xl font-medium">Open local deck</h1>
        <p className="text-sm">Start the local service and use a fresh editor URL from Codex, or enter the credentials from its connection file.</p>
        <label className="text-sm">Service URL<input className="mt-1 w-full rounded-lg border border-stroke-02 p-2" value={serviceUrl} onChange={e => setServiceUrl(e.target.value)} /></label>
        <label className="text-sm">Local token<input type="password" autoComplete="off" className="mt-1 w-full rounded-lg border border-stroke-02 p-2" value={token} onChange={e => setToken(e.target.value)} /></label>
        {message ? <p role="alert" className="text-sm">{message}</p> : null}
        <Button type="submit" disabled={connecting}>{connecting ? "Connecting..." : "Open deck"}</Button>
        <Link href="/" className="text-sm underline">Open browser presentations</Link>
      </form>
    </main>
  );
  if (preview) return <LocalDeckPreview document={loaded.document} />;
  return (
    <EditorStoreProvider initialPresentation={loaded.document.presentation} persistent={false}>
      <LocalDeckSession connection={loaded.connection} document={loaded.document} follow={follow}><EditorShell /></LocalDeckSession>
    </EditorStoreProvider>
  );
}

function LocalDeckPreview({ document }: { document: DeckSnapshot }) {
  const [index, setIndex] = useState(0);
  const slide = document.presentation.slides[index];
  return (
    <main className="min-h-dvh bg-surface-02 p-6 text-primary">
      <div className="mb-4 flex items-center gap-4">
        <h1>{document.presentation.title} · r{document.revision}</h1>
        <span className="text-sm">{index + 1}/{document.presentation.slides.length} · Text validation: estimated</span>
        <Button size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</Button>
        <Button size="sm" disabled={index === document.presentation.slides.length - 1} onClick={() => setIndex(index + 1)}>Next</Button>
        <a className="underline" href={`/editor?deckId=${encodeURIComponent(document.presentation.id)}`}>Edit deck</a>
      </div>
      <div className="mx-auto aspect-video w-full max-w-[1200px] overflow-hidden" data-testid="local-preview">
        <ClientSlideRenderer slide={slide} logicalWidth={1920} logicalHeight={1080} scale={0.625} interactive={false} />
      </div>
    </main>
  );
}
