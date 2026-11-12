"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { notifyEditor } from "@/lib/editor/notifications";
import { exportPresentationToPptx } from "@/lib/export/pptx-export";
import { useEditorStore } from "@/store/editor-store";

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const presentation = useEditorStore((state) => state.presentation);

  const handleExport = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportPresentationToPptx(presentation);
      notifyEditor(
        result.missingImageCount > 0
          ? `${result.fileName} exported with ${result.missingImageCount} unavailable image placeholder${result.missingImageCount === 1 ? "" : "s"}.`
          : `${result.fileName} exported successfully.`,
        "info",
      );
    } catch {
      notifyEditor("PowerPoint export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      aria-busy={isExporting}
      aria-label="Export presentation as PowerPoint"
      disabled={isExporting}
      onClick={handleExport}
    >
      {isExporting ? (
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin"
          strokeWidth={1.9}
        />
      ) : (
        <Download aria-hidden="true" className="size-4" strokeWidth={1.9} />
      )}
      {isExporting ? "Exporting…" : "Export"}
    </Button>
  );
}
