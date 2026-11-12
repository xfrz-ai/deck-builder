"use client";

import { useCallback } from "react";
import { PresentationCard } from "./presentation-card";
import { localRequest, type BrowserConnection } from "@/lib/local-deck/client";
import { workLabel, type ServiceDeckSummary } from "@/lib/local-deck/service-library";
import type { Slide } from "@/types/presentation";

export const serviceDeckHref = (id: string) => `/editor?deckId=${encodeURIComponent(id)}&follow=1`;
export function ServicePresentationCard({ deck, connection, now, onOpen, onDelete }: {
  deck: ServiceDeckSummary; connection: BrowserConnection; now: number; onOpen: () => void; onDelete: () => void;
}) {
  const loadCover = useCallback(async (): Promise<Slide | null> => {
    return (await localRequest(connection, `/decks/${encodeURIComponent(deck.id)}/cover?v=${deck.revision}`)).slide;
    // A cover may change at any revision; the renderer still loads it lazily.
  }, [connection, deck.id, deck.revision]);
  const label = workLabel(deck.agentWork, now);
  return <PresentationCard deck={deck} now={now} onOpen={onOpen} onDelete={onDelete} href={serviceDeckHref(deck.id)} status={`${label}${deck.agentWork?.plannedSlides ? ` · ${deck.slideCount}/${deck.agentWork.plannedSlides} slide` : ""}`} working={label === "AI sedang mengerjakan"} loadCover={loadCover} />;
}
