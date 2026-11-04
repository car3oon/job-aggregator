import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import type { ReactNode } from "react";
import { loadSource } from "../helpers.ts";

const require = createRequire(import.meta.url);
const react = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const { load } = require("cheerio") as typeof import("cheerio");

describe("CategoriesManager component", () => {
  test("renders clone button with Copy icon and accessible attributes for each category", () => {
    const component = loadSource<typeof import("../../src/components/CategoriesManager")>(
      "src/components/CategoriesManager.tsx",
      {
        react,
        "@base-ui/react/button": require("@base-ui/react/button"),
        "@/app/actions/category": {
          addCategory: async () => ({ success: true }),
          deleteCategory: async () => ({ success: true }),
          updateCategory: async () => ({ success: true }),
          cloneCategory: async () => ({ success: true }),
        },
        "@/components/ui/input": { Input: (props: Record<string, unknown>) => react.createElement("input", props) },
        "@/components/ui/textarea": { Textarea: (props: Record<string, unknown>) => react.createElement("textarea", props) },
        "@/components/ui/label": { Label: (props: Record<string, unknown>) => react.createElement("label", props) },
        "@/components/ui/button": {
          Button: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
            react.createElement("button", props, children),
        },
        "lucide-react": require("lucide-react"),
        "@/components/ui/toast": { toast: { add: () => {} } },
        "@/hooks/useEscapeKey": { useEscapeKey: () => {} },
        "react/jsx-runtime": require("react/jsx-runtime"),
      }
    );

    const categories = [
      {
        id: "cat-1",
        name: "React Frontend",
        slug: "react-frontend",
        keywords: ["react", "frontend"],
        excluded: ["junior"],
        icon: null,
      },
      {
        id: "cat-2",
        name: "Node Backend",
        slug: "node-backend",
        keywords: ["node", "backend"],
        excluded: ["frontend"],
        icon: null,
      },
    ];

    const html = renderToStaticMarkup(react.createElement(component.CategoriesManager, { initialCategories: categories }));
    const $ = load(html);

    // Verify clone buttons exist for both categories
    const cloneButton1 = $("button[aria-label='Clone React Frontend']");
    const cloneButton2 = $("button[aria-label='Clone Node Backend']");
    assert.equal(cloneButton1.length, 1);
    assert.equal(cloneButton2.length, 1);
    assert.equal(cloneButton1.attr("title"), "Clone category");
    assert.equal(cloneButton2.attr("title"), "Clone category");

    // Verify lucide Copy icon is rendered inside clone buttons
    assert.equal(cloneButton1.find("svg").length, 1);
    assert.equal(cloneButton2.find("svg").length, 1);

    // Verify edit and delete buttons are also present
    assert.equal($("button[aria-label='Edit React Frontend']").length, 1);
    assert.equal($("button[aria-label='Delete React Frontend']").length, 1);
    assert.equal($("button[aria-label='Edit Node Backend']").length, 1);
    assert.equal($("button[aria-label='Delete Node Backend']").length, 1);
  });
});
