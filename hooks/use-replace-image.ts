"use client";

import { type ChangeEvent, useRef, useState } from "react";

import { notifyEditor } from "@/lib/editor/notifications";
import { loadImageFile } from "@/lib/image/image-file";
import { useEditorStore } from "@/store/editor-store";

// Swaps an image's source while keeping its box; cover avoids distortion.
export function useReplaceImage(slideId: string, elementId: string) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const updateElement = useEditorStore((state) => state.updateElement);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setIsReplacing(true);

    try {
      const { dataUrl, height, width } = await loadImageFile(file);
      updateElement(slideId, elementId, {
        src: dataUrl,
        originalWidth: width,
        originalHeight: height,
        fit: "cover",
      });
    } catch (error) {
      notifyEditor(
        error instanceof Error
          ? error.message
          : "The image could not be replaced.",
      );
    } finally {
      input.value = "";
      setIsReplacing(false);
    }
  };

  return { fileInputRef, handleFileChange, isReplacing, openFilePicker };
}
