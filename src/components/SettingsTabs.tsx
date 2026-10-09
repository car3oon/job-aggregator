"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";

const desktopQuery = "(min-width: 48rem)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(desktopQuery).matches;
}

function getServerSnapshot() {
  return false;
}

export function SettingsTabs({ children }: { children: ReactNode }) {
  const isDesktop = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <Tabs
      defaultValue="categories"
      orientation={isDesktop ? "vertical" : "horizontal"}
      className="flex flex-col md:flex-row gap-8 items-start w-full"
    >
      {children}
    </Tabs>
  );
}
