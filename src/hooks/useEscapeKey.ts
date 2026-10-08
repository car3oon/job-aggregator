"use client";

import { useEffect, useRef } from "react";

/**
 * Custom hook to execute a callback when the Escape key is pressed.
 *
 * @param onEscape - Function to execute when Escape is pressed.
 * @param enabled - Whether the Escape key listener is active.
 */
export function useEscapeKey(onEscape: () => void, enabled: boolean = true) {
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscapeRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
