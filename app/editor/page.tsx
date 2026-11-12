import { Suspense } from "react";

import { EditorEntry } from "@/components/editor/local-deck-entry";

export default function EditorPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-surface-02" />}>
      <EditorEntry />
    </Suspense>
  );
}
