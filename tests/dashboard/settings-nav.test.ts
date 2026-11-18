import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import { loadSource } from "../helpers.ts";

const require = createRequire(import.meta.url);
const react = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const { load } = require("cheerio") as typeof import("cheerio");

function createMockLink() {
  return function Link({
    href,
    children,
    ...props
  }: {
    href: string;
    children: unknown;
    [key: string]: unknown;
  }) {
    return react.createElement("a", { href, ...props }, children as import("react").ReactNode);
  };
}

function renderNav(pathname: string) {
  const { SettingsNav, SETTINGS_NAV_ITEMS } = loadSource<
    typeof import("../../src/components/SettingsNav")
  >("src/components/SettingsNav.tsx", {
    "next/navigation": { usePathname: () => pathname },
    "next/link": { default: createMockLink() },
    "lucide-react": {
      Hash: () => react.createElement("svg", { "data-icon": "hash" }),
      MapPin: () => react.createElement("svg", { "data-icon": "map-pin" }),
      Globe: () => react.createElement("svg", { "data-icon": "globe" }),
      Sparkles: () => react.createElement("svg", { "data-icon": "sparkles" }),
      FileText: () => react.createElement("svg", { "data-icon": "file-text" }),
    },
    "@/lib/utils": require("../../src/lib/utils.ts"),
    "react/jsx-runtime": require("react/jsx-runtime"),
  });

  const html = renderToStaticMarkup(react.createElement(SettingsNav));
  const $ = load(html);
  return { $, navItems: SETTINGS_NAV_ITEMS, html };
}

describe("SettingsNav component", () => {
  test("renders all 5 settings navigation items in order", () => {
    const { $, navItems } = renderNav("/settings/categories");
    const links = $("nav[aria-label='Settings navigation'] a");
    assert.equal(links.length, 5);

    navItems.forEach((item, index) => {
      const link = links.eq(index);
      assert.equal(link.attr("href"), item.href);
      assert.match(link.text(), new RegExp(item.label));
    });
  });

  test("highlights categories tab when pathname is /settings/categories or root /settings", () => {
    for (const path of ["/settings/categories", "/settings"]) {
      const { $ } = renderNav(path);
      const activeLink = $("a[aria-current='page']");
      assert.equal(activeLink.length, 1);
      assert.equal(activeLink.attr("href"), "/settings/categories");
      assert.match(activeLink.attr("class") ?? "", /bg-background/);
    }
  });

  test("highlights subroutes correctly when pathname matches", () => {
    const cases = [
      { path: "/settings/preferences", expectedHref: "/settings/preferences", label: "Work Preferences" },
      { path: "/settings/scraper", expectedHref: "/settings/scraper", label: "Scraper Targets" },
      { path: "/settings/assistant", expectedHref: "/settings/assistant", label: "AI Assistant" },
      { path: "/settings/cv-library", expectedHref: "/settings/cv-library", label: "CV Library" },
    ];

    for (const { path, expectedHref, label } of cases) {
      const { $ } = renderNav(path);
      const activeLink = $("a[aria-current='page']");
      assert.equal(activeLink.length, 1);
      assert.equal(activeLink.attr("href"), expectedHref);
      assert.match(activeLink.text(), new RegExp(label));
    }
  });
});
