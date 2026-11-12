"use client";

import {
  ArrowUpDown,
  Check,
  ChevronDown,
  HardDrive,
  House,
  LoaderCircle,
  PanelTop,
  Plus,
  Presentation as PresentationIcon,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { EditorNotifications } from "@/components/editor/editor-notifications";
import { ImportDeckDialog } from "@/components/editor/import-deck-dialog";
import { DeckAgentPanel } from "@/components/home/deck-agent-panel";
import {
  PresentationCard,
  PresentationCardSkeleton,
  presentationHref,
  UNTITLED_PRESENTATION,
} from "@/components/home/presentation-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AI_BRIDGE_ENABLED } from "@/lib/ai/bridge-client";
import { notifyEditor } from "@/lib/editor/notifications";
import {
  createDeck,
  deleteDeck,
  duplicateDeck,
  listDecks,
  type DeckSummary,
} from "@/lib/presentation/library";
import { cn } from "@/lib/utils";
import type { Presentation } from "@/types/presentation";
import { useServiceLibrary } from "@/hooks/use-service-library";
import { ServicePresentationCard, serviceDeckHref } from "@/components/home/service-presentation-card";
import type { ServiceDeckSummary } from "@/lib/local-deck/service-library";
import { deleteLocalDeck } from "@/lib/local-deck/client";

function isServiceDeck(deck: DeckSummary): deck is ServiceDeckSummary { return "source" in deck && deck.source === "service"; }
const deckHref = (deck: DeckSummary) => isServiceDeck(deck) ? serviceDeckHref(deck.id) : presentationHref(deck.id);

type SortKey = "edited" | "created" | "name";

const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: "edited", label: "Last edited" },
  { value: "created", label: "Date created" },
  { value: "name", label: "Name" },
];

const SIDEBAR_RECENT_LIMIT = 6;

function sortDecks<T extends DeckSummary>(decks: readonly T[], sort: SortKey) {
  const sorted = [...decks];
  if (sort === "edited") sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  if (sort === "created") sorted.sort((a, b) => b.createdAt - a.createdAt);
  if (sort === "name") {
    sorted.sort((a, b) =>
      (a.title.trim() || UNTITLED_PRESENTATION).localeCompare(b.title.trim() || UNTITLED_PRESENTATION, "en", { sensitivity: "base" }),
    );
  }
  return sorted;
}

// The current minute, so "Edited 5 minutes ago" stays current.
function subscribeToMinutes(onChange: () => void) {
  const interval = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(interval);
}
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverMinute = () => 0;

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);
const subscribeNever = () => () => undefined;

export function HomeScreen() {
  const router = useRouter();
  const [browserDecks, setBrowserDecks] = useState<DeckSummary[] | null>(null);
  const service = useServiceLibrary();
  const decks = useMemo(() => browserDecks ? [...browserDecks, ...service.decks] : null, [browserDecks, service.decks]);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("edited");
  const [isCreating, setIsCreating] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const closeAi = useCallback(() => setIsAiOpen(false), []);
  const [pendingDelete, setPendingDelete] = useState<DeckSummary | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const now = useSyncExternalStore(subscribeToMinutes, currentMinute, serverMinute);
  const shortcutLabel = useSyncExternalStore(subscribeNever, () => (isMac() ? "⌘K" : "Ctrl K"), () => "⌘K");

  const refresh = useCallback(() => {
    listDecks().then(
      (next) => {
        setBrowserDecks(next);
        setLoadError("");
      },
      (error: unknown) => {
        setBrowserDecks([]);
        setLoadError(error instanceof Error ? error.message : "Presentations could not be loaded.");
      },
    );
  }, []);

  useEffect(() => {
    refresh();
    // Picks up edits made in another tab.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const visibleDecks = useMemo(() => {
    if (!decks) return null;
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? decks.filter((deck) => (deck.title.trim() || UNTITLED_PRESENTATION).toLowerCase().includes(needle))
      : decks;
    return sortDecks(matching, sort);
  }, [decks, query, sort]);

  const recentDecks = useMemo(
    () => (decks ? sortDecks(decks, "edited").slice(0, SIDEBAR_RECENT_LIMIT) : []),
    [decks],
  );

  const openDeck = useCallback(
    (deck: DeckSummary) => router.push(deckHref(deck)),
    [router],
  );

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      router.push(presentationHref(await createDeck()));
    } catch {
      notifyEditor("A new presentation could not be created in this browser.");
      setIsCreating(false);
    }
  };

  const handleImport = async (presentation: Presentation) => {
    router.push(presentationHref(await createDeck(presentation)));
  };

  const handleDuplicate = useCallback(
    async (deck: DeckSummary) => {
      try {
        await duplicateDeck(deck.id);
        notifyEditor(`Duplicated “${deck.title.trim() || UNTITLED_PRESENTATION}”.`, "info");
      } catch (error) {
        notifyEditor(error instanceof Error ? error.message : "The presentation could not be duplicated.");
      }
      refresh();
    },
    [refresh],
  );

  const handleDelete = async (deck: DeckSummary) => {
    setPendingDelete(null);
    try {
      if (isServiceDeck(deck)) {
        if (!service.connection) throw new Error("Connect to the local deck service before deleting this presentation.");
        await deleteLocalDeck(service.connection, deck.id, deck.revision);
      } else await deleteDeck(deck.id);
      notifyEditor(`Deleted “${deck.title.trim() || UNTITLED_PRESENTATION}”.`, "info");
    } catch (error) {
      notifyEditor(error instanceof Error ? error.message : "The presentation could not be deleted.");
    }
    if (isServiceDeck(deck)) service.refresh(); else refresh();
  };

  const actionButtons = (
    <>
      {AI_BRIDGE_ENABLED ? (
        <Button
          aria-expanded={isAiOpen}
          className="border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setIsAiOpen(true)}
          variant="outline"
        >
          <Sparkles aria-hidden="true" className="size-4" strokeWidth={1.9} />
          Create with AI
        </Button>
      ) : null}
      <Button aria-label="Import a deck" onClick={() => setIsImportOpen(true)}>
        <Upload aria-hidden="true" className="size-4" strokeWidth={1.9} />
        Import
      </Button>
      <Button aria-busy={isCreating} disabled={isCreating} onClick={handleCreate}>
        {isCreating ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={1.9} />
        ) : (
          <Plus aria-hidden="true" className="size-4" strokeWidth={1.9} />
        )}
        Create presentation
      </Button>
    </>
  );

  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label;

  return (
    <div className="min-h-dvh bg-surface-02 text-foreground">
      <EditorNotifications className="right-6" />

      <aside className="fixed bottom-3 left-3 top-3 z-10 hidden w-60 flex-col rounded-[1.25rem] border border-stroke-01 bg-surface-01 lg:flex">
        <div className="flex items-center gap-2.5 border-b border-stroke-01 p-4">
          <div aria-hidden="true" className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-surface-01">
            <PanelTop className="size-4" strokeWidth={2} />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-primary">Deck</span>
        </div>

        <nav aria-label="Main" className="p-3">
          <Link
            aria-current="page"
            className="flex h-9 items-center gap-2.5 rounded-xl border border-stroke-02 bg-surface-03 px-2.5 text-[13px] font-medium text-primary"
            href="/"
          >
            <House aria-hidden="true" className="size-4" strokeWidth={1.8} />
            Home
          </Link>
        </nav>

        <div className="editor-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {recentDecks.length ? (
            <>
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-muted-foreground">Recent</p>
              <ul className="flex flex-col gap-0.5">
                {recentDecks.map((deck) => (
                  <li key={deck.id}>
                    <Link
                      className="flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-surface-03"
                      href={deckHref(deck)}
                    >
                      <PresentationIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                      <span className="truncate">{deck.title.trim() || UNTITLED_PRESENTATION}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div className="m-3 mt-0 rounded-xl bg-surface-03 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-primary">
            <HardDrive aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            Saved in this browser
          </p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            Presentations stay on this device. Export to PowerPoint to share them.
          </p>
        </div>
      </aside>

      {/* Leaves room for the AI panel on wide screens so new decks stay visible. */}
      <div className={cn("lg:pl-[264px]", isAiOpen && "xl:pr-[412px]")}>
        <header className="flex h-[76px] items-center gap-3 px-5 pt-3">
          <label className="relative w-full max-w-[360px]">
            <span className="sr-only">Search presentations</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
            <input
              className="h-10 w-full rounded-xl border border-stroke-01 bg-surface-01 pl-9 pr-16 text-[13px] font-medium text-primary outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground hover:border-stroke-02 focus:border-stroke-02 focus-visible:ring-2 focus-visible:ring-ring/35"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  event.currentTarget.blur();
                }
              }}
              placeholder="Search presentations…"
              ref={searchRef}
              type="search"
              value={query}
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-stroke-02 bg-surface-03 px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
              {shortcutLabel}
            </kbd>
          </label>

          <div className="ml-auto flex items-center gap-2">{actionButtons}</div>
        </header>

        <main className="px-5 pb-12 pt-6">
          <p className="mb-4 text-xs text-muted-foreground" role="status" data-testid="agent-library-status">
            {service.connection ? service.status === "connected" ? "CLI agent connected. New presentations appear here automatically." : "Reconnecting to the local agent..." : "Start npm run deck-agent to connect this Library to your CLI."}
            {service.message ? ` ${service.message}` : ""}
          </p>
          <div className="mb-5 flex items-center justify-between gap-4">
            <h1 className="text-[22px] font-medium tracking-[-0.03em] text-primary">Recent presentations</h1>

            {decks && decks.length > 1 ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-1.5 px-3 text-muted-foreground hover:text-primary data-[state=open]:text-primary" size="sm" variant="ghost">
                    <ArrowUpDown aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                    <span className="text-primary">{sortLabel}</span>
                    <ChevronDown aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-40">
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem key={option.value} onSelect={() => setSort(option.value)}>
                      <Check
                        aria-hidden="true"
                        className={cn("size-3.5", option.value === sort ? "opacity-100" : "opacity-0")}
                        strokeWidth={2}
                      />
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          {loadError ? (
            <p className="mb-4 rounded-[10px] bg-[#E04E2B]/10 p-3 text-xs text-[#B3361A]" role="alert">{loadError}</p>
          ) : null}

          {visibleDecks === null ? (
            <div aria-busy="true" aria-label="Loading presentations" className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {Array.from({ length: 4 }, (_, index) => <PresentationCardSkeleton key={index} />)}
            </div>
          ) : decks?.length === 0 && !loadError ? (
            <div className="flex flex-col items-center rounded-[1.25rem] border border-dashed border-stroke-02 bg-surface-01 px-6 py-20 text-center">
              <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-stroke-01 bg-surface-01 text-primary shadow-toolbar">
                <PresentationIcon aria-hidden="true" className="size-5" strokeWidth={1.8} />
              </div>
              <h2 className="text-lg font-medium tracking-[-0.03em] text-primary">No presentations yet</h2>
              <p className="mt-1.5 max-w-sm text-[13px] leading-5 text-muted-foreground">
                Start from a blank deck, or import a deck spec or document to build one.
              </p>
              <div className="mt-6 flex items-center gap-2">{actionButtons}</div>
            </div>
          ) : visibleDecks.length === 0 && query.trim() ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">
              No presentations match “{query.trim()}”.
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {visibleDecks.map((deck) => isServiceDeck(deck) && service.connection ? (
                <li key={deck.id}><ServicePresentationCard deck={deck} connection={service.connection} now={now} onOpen={() => openDeck(deck)} onDelete={() => setPendingDelete(deck)} /></li>
              ) : (
                <li key={deck.id}>
                  <PresentationCard
                    deck={deck}
                    now={now}
                    onDelete={setPendingDelete}
                    onDuplicate={handleDuplicate}
                    onOpen={openDeck}
                  />
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>

      {AI_BRIDGE_ENABLED ? (
        <DeckAgentPanel
          onClose={closeAi}
          onOpenDeck={(deckId) => router.push(serviceDeckHref(deckId))}
          open={isAiOpen}
          serviceConnected={Boolean(service.connection)}
        />
      ) : null}

      {isImportOpen ? (
        <ImportDeckDialog
          onClose={() => setIsImportOpen(false)}
          onImport={handleImport}
          target="new"
        />
      ) : null}

      {pendingDelete ? (
        <DeleteDialog
          deck={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete)}
        />
      ) : null}
    </div>
  );
}

function DeleteDialog({ deck, onCancel, onConfirm }: {
  deck: DeckSummary;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // After the menu that opened this dialog has returned focus.
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[#121212]/20 backdrop-blur-[2px]" onMouseDown={onCancel} />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-[380px] rounded-[1.25rem] border border-stroke-01 bg-surface-01 p-5 shadow-popover"
        role="alertdialog"
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-primary" id={titleId}>
          Delete presentation?
        </h2>
        <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground" id={descriptionId}>
          “{deck.title.trim() || UNTITLED_PRESENTATION}” {isServiceDeck(deck)
            ? "will be removed from the local deck service and Library. An active agent will no longer be able to update it."
            : "will be permanently removed from this browser."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} ref={cancelRef} variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-none bg-[#E04E2B] text-white shadow-none hover:bg-[#CC4524]"
            onClick={onConfirm}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
