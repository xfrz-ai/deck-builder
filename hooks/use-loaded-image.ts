"use client";

import { useCallback, useSyncExternalStore } from "react";

type ImageLoadStatus = "error" | "loaded" | "loading";

interface ImageSnapshot {
  image: HTMLImageElement | null;
  status: ImageLoadStatus;
}

interface ImageCacheEntry {
  image: HTMLImageElement;
  listeners: Set<() => void>;
  snapshot: ImageSnapshot;
}

const imageCache = new Map<string, ImageCacheEntry>();
const serverSnapshot: ImageSnapshot = { image: null, status: "loading" };

function getImageEntry(src: string) {
  const cached = imageCache.get(src);

  if (cached) {
    return cached;
  }

  const image = new Image();
  const entry: ImageCacheEntry = {
    image,
    listeners: new Set(),
    snapshot: { image: null, status: "loading" },
  };

  const publish = (status: ImageLoadStatus) => {
    entry.snapshot = {
      image: status === "loaded" ? image : null,
      status,
    };
    entry.listeners.forEach((listener) => listener());
  };

  image.onload = () => publish("loaded");
  image.onerror = () => publish("error");
  image.src = src;
  imageCache.set(src, entry);

  return entry;
}

// Starts loading `src` into the shared cache so a later render shows it at
// once instead of flashing in.
export function preloadImage(src: string) {
  getImageEntry(src);
}

function subscribeToImage(src: string, listener: () => void) {
  const entry = getImageEntry(src);
  entry.listeners.add(listener);

  return () => entry.listeners.delete(listener);
}

export function useLoadedImage(src: string) {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToImage(src, listener),
    [src],
  );
  const getSnapshot = useCallback(() => getImageEntry(src).snapshot, [src]);
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot,
  );

  return {
    error: snapshot.status === "error",
    image: snapshot.image,
    loading: snapshot.status === "loading",
  };
}
