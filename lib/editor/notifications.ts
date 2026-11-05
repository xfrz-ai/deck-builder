export const EDITOR_NOTIFICATION_EVENT = "deck-editor:notification";

export type EditorNotificationTone = "error" | "info";

export interface EditorNotificationDetail {
  message: string;
  tone: EditorNotificationTone;
}

export function notifyEditor(
  message: string,
  tone: EditorNotificationTone = "error",
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<EditorNotificationDetail>(EDITOR_NOTIFICATION_EVENT, {
      detail: { message, tone },
    }),
  );
}
