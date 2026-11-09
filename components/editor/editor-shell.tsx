"use client";

import { MonitorUp } from "lucide-react";
import { useSyncExternalStore } from "react";

import { CanvasWorkspace } from "@/components/editor/canvas-workspace";
import { AgendaEditorDialog } from "@/components/editor/agenda-editor-dialog";
import { TeamEditorDialog } from "@/components/editor/team-editor-dialog";
import { TimelineEditorDialog } from "@/components/editor/timeline-editor-dialog";
import { EditorKeyboardShortcuts } from "@/components/editor/editor-keyboard-shortcuts";
import { EditorNotifications } from "@/components/editor/editor-notifications";
import { PropertiesPanel } from "@/components/editor/properties-panel";
import { SlideSidebar } from "@/components/editor/slide-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEditorStore } from "@/store/editor-store";

const DESKTOP_MEDIA_QUERY = "(min-width: 1280px)";

function subscribeToDesktopViewport(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

function DesktopNotice() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-02 px-6 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-stroke-01 bg-surface-01 text-primary shadow-toolbar">
          <MonitorUp aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </div>
        <h1 className="text-xl font-medium tracking-[-0.03em] text-primary">
          A wider canvas works better
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
          Presentation editing is currently optimized for desktop screens at
          least 1280px wide.
        </p>
      </div>
    </main>
  );
}

export function EditorShell() {
  const agendaEditor = useEditorStore((state) => state.agendaEditor);
  const teamEditor = useEditorStore((state) => state.teamEditor);
  const timelineEditor = useEditorStore((state) => state.timelineEditor);
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopViewport,
    getDesktopSnapshot,
    getServerSnapshot,
  );

  if (!isDesktop) {
    return <DesktopNotice />;
  }

  return (
    <TooltipProvider delayDuration={450}>
      <EditorKeyboardShortcuts />
      <EditorNotifications />
      <div className="relative h-dvh min-h-[720px] overflow-hidden bg-surface-02 text-foreground">
        <CanvasWorkspace />
        <SlideSidebar />
        <PropertiesPanel />
        {agendaEditor ? <AgendaEditorDialog key={agendaEditor.initialData.id} session={agendaEditor} /> : null}
        {teamEditor ? <TeamEditorDialog key={teamEditor.initialData.id} session={teamEditor} /> : null}
        {timelineEditor ? <TimelineEditorDialog key={timelineEditor.initialData.id} session={timelineEditor} /> : null}
      </div>
    </TooltipProvider>
  );
}
