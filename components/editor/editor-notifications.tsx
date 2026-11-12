"use client";

import { AlertCircle, Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  EDITOR_NOTIFICATION_EVENT,
  type EditorNotificationDetail,
} from "@/lib/editor/notifications";
import { cn } from "@/lib/utils";

// Sits left of the editor's properties panel unless `className` moves it.
export function EditorNotifications({ className }: { className?: string } = {}) {
  const [notification, setNotification] =
    useState<EditorNotificationDetail | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const handleNotification = (event: Event) => {
      const detail = (event as CustomEvent<EditorNotificationDetail>).detail;

      if (!detail?.message) {
        return;
      }

      clearTimer();
      setNotification(detail);
      timeoutRef.current = setTimeout(() => setNotification(null), 5500);
    };

    window.addEventListener(EDITOR_NOTIFICATION_EVENT, handleNotification);
    return () => {
      clearTimer();
      window.removeEventListener(
        EDITOR_NOTIFICATION_EVENT,
        handleNotification,
      );
    };
  }, []);

  if (!notification) {
    return null;
  }

  const Icon = notification.tone === "error" ? AlertCircle : Info;

  return (
    <div
      aria-live="polite"
      className={cn(
        "fixed bottom-6 right-[304px] z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-stroke-01 bg-surface-01 px-4 py-3 text-[13px] text-primary shadow-popover",
        className,
      )}
      role={notification.tone === "error" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        className={
          notification.tone === "error"
            ? "mt-0.5 size-4 shrink-0 text-destructive"
            : "mt-0.5 size-4 shrink-0 text-primary"
        }
      />
      <p className="leading-5">{notification.message}</p>
      <Button
        aria-label="Dismiss notification"
        className="-mr-2 -mt-1 shrink-0 text-muted-foreground"
        onClick={() => setNotification(null)}
        size="icon-sm"
        variant="ghost"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
