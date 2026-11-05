"use client";

import dynamic from "next/dynamic";

import type { SlideRendererProps } from "@/components/editor/slide-renderer";

export const ClientSlideRenderer = dynamic<SlideRendererProps>(
  () => import("@/components/editor/slide-renderer"),
  {
    ssr: false,
    loading: () => <div className="size-full animate-pulse bg-white" />,
  },
);
