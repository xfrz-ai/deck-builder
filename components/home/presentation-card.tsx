"use client";

import { Copy, Ellipsis, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";

import { ClientSlideRenderer } from "@/components/editor/client-slide-renderer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DeckSummary } from "@/lib/presentation/library";
import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type Slide,
} from "@/types/presentation";

export const UNTITLED_PRESENTATION = "Untitled Presentation";

export function presentationHref(id: string) {
  return `/editor?presentation=${encodeURIComponent(id)}`;
}

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatEdited(timestamp: number, now: number) {
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 1) return "Edited just now";
  if (minutes < 60) return `Edited ${relativeTime.format(-minutes, "minute")}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Edited ${relativeTime.format(-hours, "hour")}`;
  const days = Math.round(hours / 24);
  if (days < 7) return `Edited ${relativeTime.format(-days, "day")}`;
  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return `Edited ${date.toLocaleDateString("en", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" })}`;
}

// Renders the slide once the card scrolls into view, so a long list doesn't
// start a canvas for every deck up front.
function CoverPreview({ slide, loadSlide }: { slide: Slide | null; loadSlide?: () => Promise<Slide | null> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loadedSlide, setLoadedSlide] = useState<Slide | null>(null);
  useEffect(() => {
    if (!visible || !loadSlide) return;
    let cancelled = false;
    loadSlide().then(value => { if (!cancelled) setLoadedSlide(value); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [visible, loadSlide]);
  const cover = slide ?? loadedSlide;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        intersectionObserver.disconnect();
      }
    }, { rootMargin: "200px" });

    resizeObserver.observe(container);
    intersectionObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(18,18,18,0.06)]"
      ref={containerRef}
    >
      {cover && visible && width > 0 ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <ClientSlideRenderer
            interactive={false}
            logicalHeight={PRESENTATION_HEIGHT}
            logicalWidth={PRESENTATION_WIDTH}
            scale={width / PRESENTATION_WIDTH}
            slide={cover}
          />
        </div>
      ) : null}
    </div>
  );
}

interface PresentationCardProps {
  deck: DeckSummary;
  now: number;
  onDelete?: (deck: DeckSummary) => void;
  onDuplicate?: (deck: DeckSummary) => void;
  onOpen: (deck: DeckSummary) => void;
  href?: string;
  status?: string;
  working?: boolean;
  loadCover?: () => Promise<Slide | null>;
}

export const PresentationCard = memo(function PresentationCard({
  deck,
  now,
  onDelete,
  onDuplicate,
  onOpen,
  href,
  status,
  working,
  loadCover,
}: PresentationCardProps) {
  const title = deck.title.trim() || UNTITLED_PRESENTATION;

  return (
    <article data-deck-id={deck.id} data-agent-status={working ? "working" : undefined} className="group relative rounded-[1.25rem] border border-stroke-01 bg-surface-01 p-2 transition-shadow hover:shadow-toolbar has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/35">
      <CoverPreview slide={deck.coverSlide} loadSlide={loadCover} />
      {status ? <p className="flex items-center gap-2 px-2 pt-2 text-xs font-medium text-primary" role="status">{working ? <span aria-hidden="true" className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" /> : null}{status}</p> : null}

      <div className="flex items-start gap-2 pb-1.5 pl-2 pr-0.5 pt-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-primary">
            {/* The link covers the whole card; the menu button sits above it. */}
            <Link
              className="outline-none after:absolute after:inset-0 after:rounded-[1.25rem]"
              href={href ?? presentationHref(deck.id)}
            >
              {title}
            </Link>
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {deck.slideCount} {deck.slideCount === 1 ? "slide" : "slides"}
            {" · "}
            {formatEdited(deck.updatedAt, now)}
          </p>
        </div>

        {onDelete || onDuplicate ? <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`More actions for ${title}`}
              className="relative z-10 text-muted-foreground opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
              size="icon-sm"
              variant="ghost"
            >
              <Ellipsis aria-hidden="true" className="size-4" strokeWidth={1.8} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem onSelect={() => onOpen(deck)}>
              <SquarePen aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
              Open
            </DropdownMenuItem>
            {onDuplicate ? <DropdownMenuItem onSelect={() => onDuplicate(deck)}>
              <Copy aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
              Duplicate
            </DropdownMenuItem> : null}
            {onDelete ? <DropdownMenuItem
              className="text-[#B3361A] focus:bg-[#E04E2B]/10 focus:text-[#B3361A]"
              onSelect={() => onDelete(deck)}
            >
              <Trash2 aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
              Delete
            </DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu> : null}
      </div>
    </article>
  );
});

export function PresentationCardSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-[1.25rem] border border-stroke-01 bg-surface-01 p-2">
      <div className="aspect-video w-full animate-pulse rounded-xl bg-surface-03" />
      <div className="space-y-2 px-2 pb-2.5 pt-3.5">
        <div className="h-3.5 w-3/5 animate-pulse rounded bg-surface-03" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-surface-03" />
      </div>
    </div>
  );
}
