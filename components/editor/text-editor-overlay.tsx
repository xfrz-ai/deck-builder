"use client";

import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";

import type { TextElement } from "@/types/presentation";

interface TextEditorOverlayProps {
  element: TextElement;
  onCancel: () => void;
  onCommit: (value: { height: number; text: string }) => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  scale: number;
  selectAllOnFocus?: boolean;
  autoSave?: boolean;
  onNavigate?: (direction: -1 | 1) => void;
}

export function TextEditorOverlay({
  element,
  onCancel,
  onCommit,
  onToggleBold,
  onToggleItalic,
  scale,
  selectAllOnFocus = false,
  autoSave = true,
  onNavigate,
}: TextEditorOverlayProps) {
  const [draftText, setDraftText] = useState(element.text);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const originalTextRef = useRef(element.text);
  const originalHeightRef = useRef(element.height);
  const latestTextRef = useRef(element.text);
  const latestHeightRef = useRef(element.height);
  const finalizeStateRef = useRef<"active" | "cancelled" | "committed">(
    "active",
  );
  const commitRef = useRef(onCommit);

  useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (!autoSave) return;
    if (
      draftText === originalTextRef.current &&
      latestHeightRef.current === originalHeightRef.current
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (finalizeStateRef.current === "active") {
        commitRef.current({
          height: latestHeightRef.current,
          text: latestTextRef.current,
        });
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [autoSave, draftText]);

  useEffect(() => {
    const commitBeforeUnload = () => {
      if (finalizeStateRef.current === "active") {
        commitRef.current({
          height: latestHeightRef.current,
          text: latestTextRef.current,
        });
      }
    };

    window.addEventListener("beforeunload", commitBeforeUnload);
    return () => window.removeEventListener("beforeunload", commitBeforeUnload);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.focus({ preventScroll: true });

      if (selectAllOnFocus) {
        textarea.select();
      } else {
        const caretPosition = textarea.value.length;
        textarea.setSelectionRange(caretPosition, caretPosition);
      }
    }

    return () => {
      if (finalizeStateRef.current === "active") {
        commitRef.current({
          height: latestHeightRef.current,
          text: latestTextRef.current,
        });
      }
    };
  }, [selectAllOnFocus]);

  const commit = () => {
    if (finalizeStateRef.current !== "active") {
      return;
    }

    finalizeStateRef.current = "committed";
    onCommit({
      height: latestHeightRef.current,
      text: latestTextRef.current,
    });
  };

  const cancel = () => {
    if (finalizeStateRef.current !== "active") {
      return;
    }

    finalizeStateRef.current = "cancelled";
    onCommit({
      height: originalHeightRef.current,
      text: originalTextRef.current,
    });
    onCancel();
  };

  const padding = (element.padding ?? 0) * scale;
  const wrapperStyle: CSSProperties = {
    alignItems:
      element.verticalAlign === "middle"
        ? "center"
        : element.verticalAlign === "bottom"
          ? "flex-end"
          : "flex-start",
    display: "flex",
    height: element.height * scale,
    left: element.x * scale,
    opacity: element.opacity,
    pointerEvents: "none",
    position: "absolute",
    top: element.y * scale,
    transform: `rotate(${element.rotation}deg)`,
    transformOrigin: "top left",
    width: element.width * scale,
    zIndex: 30,
  };
  const textareaStyle: CSSProperties = {
    background: "transparent",
    border: 0,
    boxSizing: "border-box",
    color: element.color,
    fontFamily:
      element.fontFamily === "Inter"
        ? "var(--font-inter), Arial, sans-serif"
        : element.fontFamily,
    fontSize: element.fontSize * scale,
    fontStyle: element.italic ? "italic" : "normal",
    fontWeight: element.fontWeight,
    fieldSizing: "content",
    letterSpacing: element.letterSpacing * scale,
    lineHeight: element.lineHeight,
    margin: 0,
    maxHeight: "100%",
    outline: "none",
    overflow: "hidden",
    padding,
    pointerEvents: "auto",
    resize: "none",
    textAlign: element.align === "justify" ? "justify" : element.align,
    textDecoration: element.textDecoration ?? "none",
    width: "100%",
  };

  return (
    <div style={wrapperStyle}>
      <textarea
        aria-label="Edit text"
        data-text-editor="true"
        onBlur={() => {
          if (finalizeStateRef.current !== "active") return;
          commit();
          onCancel();
        }}
        onChange={(event) => {
          latestTextRef.current = event.target.value;
          latestHeightRef.current = Math.max(
            element.height,
            Math.ceil(
              event.currentTarget.scrollHeight / Math.max(scale, 0.01),
            ),
          );
          setDraftText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab" && onNavigate) {
            event.preventDefault();
            event.stopPropagation();
            commit();
            onNavigate(event.shiftKey ? -1 : 1);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancel();
            return;
          }

          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            commit();
            onCancel();
            return;
          }

          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "b"
          ) {
            event.preventDefault();
            onToggleBold();
            return;
          }

          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === "i"
          ) {
            event.preventDefault();
            onToggleItalic();
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        ref={textareaRef}
        rows={1}
        spellCheck
        style={textareaStyle}
        value={draftText}
      />
    </div>
  );
}
