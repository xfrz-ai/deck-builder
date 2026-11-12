"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { CONNECTION_EVENT, localRequest, readBrowserConnection, type BrowserConnection } from "@/lib/local-deck/client";
import { serviceSummarySchema, type ServiceDeckSummary } from "@/lib/local-deck/service-library";
import { watchLibraryEvents, type LiveConnectionStatus } from "@/lib/local-deck/event-client";

export function useServiceLibrary() {
  const [decks, setDecks] = useState<ServiceDeckSummary[]>([]);
  const [connection, setConnection] = useState<BrowserConnection | null>(null);
  const [status, setStatus] = useState<LiveConnectionStatus>("connecting");
  const [message, setMessage] = useState("");
  const refreshRef = useRef(() => {});
  useEffect(() => {
    let active = true;
    let key = "";
    let abort: AbortController | undefined;
    let refresh = () => undefined as void;
    const connect = () => {
      let next: BrowserConnection | null;
      try { next = readBrowserConnection(); } catch { setMessage("Open a fresh Library link from the CLI to connect."); return; }
      if (!next || key === JSON.stringify(next)) return;
      key = JSON.stringify(next); abort?.abort(); abort = new AbortController();
      const current = abort;
      setConnection(next); setDecks([]); setMessage("");
      let loading = false;
      let again = false;
      refresh = () => {
        if (!active || current.signal.aborted) return;
        again = true;
        if (loading) return;
        loading = true;
        void (async () => {
          try {
            while (again && active && !current.signal.aborted) {
              again = false;
              const result = await localRequest(next, "/decks");
              const items = z.array(serviceSummarySchema).parse(result.decks);
              if (!active || current.signal.aborted) return;
              setDecks(items.map(item => ({ ...item, source: "service", coverSlide: null })));
              setMessage(result.unavailableCount ? `${result.unavailableCount} local deck(s) could not be read.` : "");
            }
          } catch { if (active && !current.signal.aborted) setMessage("Local agent unavailable. Start or restart npm run deck-service."); }
          finally { loading = false; }
        })();
      };
      refreshRef.current = refresh;
      refresh();
      void watchLibraryEvents(next, {
        event: event => { if (event.type === "document.committed" || event.type === "document.deleted" || event.type === "connection.sync") refresh(); },
        status: value => { if (active && !current.signal.aborted) setStatus(value); },
      }, current.signal);
    };
    const focus = () => refresh();
    window.addEventListener(CONNECTION_EVENT, connect);
    window.addEventListener("focus", focus);
    connect();
    return () => { active = false; refreshRef.current = () => {}; abort?.abort(); window.removeEventListener(CONNECTION_EVENT, connect); window.removeEventListener("focus", focus); };
  }, []);
  return { decks, connection, status, message, refresh: () => refreshRef.current() };
}
