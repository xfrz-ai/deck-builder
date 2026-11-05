import { EditorShell } from "@/components/editor/editor-shell";
import { EditorStoreProvider } from "@/store/editor-store";

export default function EditorPage() {
  return (
    <EditorStoreProvider>
      <EditorShell />
    </EditorStoreProvider>
  );
}
