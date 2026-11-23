// The contract between the shell (shell.ts, inside the app) and the engine
// (engine.ts, inside an updatable bundle). Changing it means raising
// SHELL_API in bundles.ts, so new bundles aren't loaded by old shells.

export interface EngineContext {
  // The bundle folder the engine was loaded from.
  bundleDir: string;
  // Where the deck service keeps its files and token.
  dataDir: string;
  bundle: { build: number; version: string; source: "builtin" | "downloaded" };
  shellVersion: string;
}

export interface EngineHandle {
  // Shows and focuses the main window, opening it again if it was closed.
  focus(): void;
  stop(): Promise<void>;
}

export interface EngineModule {
  start(context: EngineContext): Promise<EngineHandle>;
}

// Thrown when another program uses a port the app needs. The bundle is not at
// fault, so the shell doesn't fall back to an older one.
export class PortInUseError extends Error {
  readonly code = "PORT_IN_USE";
}
