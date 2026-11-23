"use client";

import { LoaderCircle, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { UNTITLED_PRESENTATION } from "@/components/home/presentation-card";
import { Button } from "@/components/ui/button";
import { addShare, listShares, removeShare } from "@/lib/cloud/cloud-library";
import type { DeckSummary } from "@/lib/presentation/deck-library";

// Lets the owner give colleagues edit access by email. Colleagues don't need
// to have signed in before; the deck appears once they do.
export function ShareDeckDialog({ deck, onClose }: { deck: DeckSummary; onClose: () => void }) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [emails, setEmails] = useState<string[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    listShares(deck.id).then(
      (next) => active && setEmails(next),
      (error: unknown) => {
        if (!active) return;
        setEmails([]);
        setMessage(error instanceof Error ? error.message : "Sharing settings could not be loaded.");
      },
    );
    return () => {
      active = false;
    };
  }, [deck.id]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const add = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const added = await addShare(deck.id, email);
      setEmails((current) => [...(current ?? []), added]);
      setEmail("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The presentation could not be shared.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (target: string) => {
    setMessage("");
    try {
      await removeShare(deck.id, target);
      setEmails((current) => (current ?? []).filter((item) => item !== target));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access could not be removed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[#121212]/20 backdrop-blur-[2px]" onMouseDown={onClose} />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-[420px] rounded-[1.25rem] border border-stroke-01 bg-surface-01 p-5 shadow-popover"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-primary" id={titleId}>
              Share “{deck.title.trim() || UNTITLED_PRESENTATION}”
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              People you add can open and edit this presentation.
            </p>
          </div>
          <Button aria-label="Close" className="-mr-1 -mt-1 text-muted-foreground" onClick={onClose} size="icon-sm" variant="ghost">
            <X aria-hidden="true" className="size-4" strokeWidth={1.8} />
          </Button>
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Colleague&apos;s work email</span>
            <input
              className="h-10 w-full rounded-xl border border-stroke-01 bg-surface-01 px-3 text-[13px] font-medium text-primary outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground hover:border-stroke-02 focus:border-stroke-02 focus-visible:ring-2 focus-visible:ring-ring/35"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Colleague's work email"
              ref={inputRef}
              type="email"
              value={email}
            />
          </label>
          <Button aria-busy={busy} disabled={busy || !email.trim()} type="submit">
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={1.9} /> : null}
            Add
          </Button>
        </form>

        {message ? (
          <p className="mt-3 rounded-[10px] bg-[#E04E2B]/10 p-3 text-xs text-[#B3361A]" role="alert">
            {message}
          </p>
        ) : null}

        <div className="mt-4">
          <p className="pb-1.5 text-[11px] font-medium text-muted-foreground">People with access</p>
          {emails === null ? (
            <LoaderCircle aria-label="Loading" className="my-2 size-4 animate-spin text-muted-foreground" strokeWidth={1.8} />
          ) : (
            <ul className="flex flex-col gap-0.5">
              <li className="flex h-9 items-center gap-2.5 rounded-xl px-2 text-[13px] text-primary">
                <UserRound aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                <span className="min-w-0 flex-1 truncate font-medium">You</span>
                <span className="text-xs text-muted-foreground">Owner</span>
              </li>
              {emails.map((item) => (
                <li className="group flex h-9 items-center gap-2.5 rounded-xl px-2 text-[13px] text-primary hover:bg-surface-03" key={item}>
                  <UserRound aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <span className="min-w-0 flex-1 truncate">{item}</span>
                  <Button
                    aria-label={`Remove ${item}`}
                    className="text-muted-foreground"
                    onClick={() => void remove(item)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <X aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
