import { Suspense } from "react";

import { EditorEntry } from "@/components/editor/local-deck-entry";

export default function PreviewPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading preview...</main>}>
      <EditorEntry preview />
    </Suspense>
  );
}
