import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import type { ReactNode } from "react";
import { loadSource } from "../helpers.ts";

const require = createRequire(import.meta.url);
const react = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const { load } = require("cheerio") as typeof import("cheerio");
const tabs = loadSource<typeof import("../../src/components/ui/tabs")>("src/components/ui/tabs.tsx", {
  "@base-ui/react/tabs": require("@base-ui/react/tabs"),
  "class-variance-authority": require("class-variance-authority"),
  cn: require("cn"), "react/jsx-runtime": require("react/jsx-runtime"),
});

describe("Settings tab orientation", () => {
  for (const orientation of ["horizontal", "vertical"] as const) {
    test(`${orientation} tabs expose the matching Base UI accessibility orientation`, () => {
      const html = renderToStaticMarkup(react.createElement(tabs.Tabs, { orientation, defaultValue: "categories" },
        react.createElement(tabs.TabsList, null,
          react.createElement(tabs.TabsTrigger, { value: "categories" }, "Categories"),
          react.createElement(tabs.TabsTrigger, { value: "preferences" }, "Work Preferences"))));
      const $ = load(html);
      assert.equal($("[data-slot=tabs]").attr("data-orientation"), orientation);
      assert.equal($("[role=tablist]").attr("aria-orientation") ?? "horizontal", orientation);
    });
  }

  test("responsive orientation has a safe server snapshot and responds to media changes with cleanup", () => {
    const listeners = new Set<() => void>();
    const media = {
      matches: false,
      addEventListener: (event: string, callback: () => void) => { assert.equal(event, "change"); listeners.add(callback); },
      removeEventListener: (event: string, callback: () => void) => { assert.equal(event, "change"); listeners.delete(callback); },
    };
    let server = true;
    let changes = 0;
    let subscribe!: (callback: () => void) => () => void;
    let mediaReads = 0;
    const jsx = (type: unknown, props: { orientation: string; children: ReactNode }) => ({ type, props });
    const { SettingsTabs } = loadSource<{ SettingsTabs: (input: { children: ReactNode }) => ReturnType<typeof jsx> }>("src/components/SettingsTabs.tsx", {
      react: { useSyncExternalStore: (subscription: typeof subscribe, snapshot: () => boolean, serverSnapshot: () => boolean) => {
        subscribe = subscription;
        return server ? serverSnapshot() : snapshot();
      } },
      "@/components/ui/tabs": { Tabs: () => null }, "react/jsx-runtime": { jsx },
    }, { globals: { window: { matchMedia: (query: string) => {
      assert.equal(query, "(min-width: 48rem)");
      mediaReads++;
      return media;
    } } } });
    assert.equal(SettingsTabs({ children: "content" }).props.orientation, "horizontal");
    assert.equal(mediaReads, 0, "Server rendering must not access matchMedia");
    server = false;
    assert.equal(SettingsTabs({ children: "content" }).props.orientation, "horizontal");
    const unsubscribe = subscribe(() => { changes++; });
    media.matches = true;
    listeners.forEach(callback => callback());
    assert.equal(changes, 1);
    assert.equal(SettingsTabs({ children: "content" }).props.orientation, "vertical");
    media.matches = false;
    listeners.forEach(callback => callback());
    assert.equal(SettingsTabs({ children: "content" }).props.orientation, "horizontal");
    unsubscribe();
    assert.equal(listeners.size, 0);
  });
});
