"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A media query is an external store, so it is read as one rather than mirrored
 * into state inside an effect — no cascading render on mount.
 *
 * The server snapshot is `false`, so the first paint is always the desktop
 * layout: the one that matches the Figma frames.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** The panel stops sharing the screen with the stage below this width. */
export const MOBILE_QUERY = "(max-width: 768px)";
