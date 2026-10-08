import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadSource } from "../helpers.ts";

function authContext() {
  const env: { ADMIN_PASSWORD: string; SESSION_SECRET: string | undefined } = {
    ADMIN_PASSWORD: "test-administrator-password", SESSION_SECRET: "test-secret-with-at-least-32-bytes-long",
  };
  const session = loadSource("src/lib/session.ts", {}, { process: { env } }) as typeof import("../../src/lib/session");
  let value: string | undefined;
  const writes: [string, string, Record<string, unknown>][] = [];
  const cookieStore = {
    get: () => value === undefined ? undefined : { value },
    set: (...args: [string, string, Record<string, unknown>]) => writes.push(args),
    delete: () => { value = undefined; },
  };
  const headers = { cookies: async () => cookieStore };
  const auth = loadSource("src/lib/auth.ts", { "next/headers": headers, "@/lib/session": session }) as typeof import("../../src/lib/auth");
  return { env, session, auth, headers, writes, setCookie: (token: string | undefined) => { value = token; } };
}

describe("Authentication and access control", () => {
  test("sessions reject old cookies, tampering, malformed tokens and expiration", () => {
    const { session, env } = authContext();
    const now = 1_800_000_000_000;
    const token = session.createSessionToken(now);
    assert.equal(session.verifySessionToken(token, now), true);
    assert.notEqual(token, session.createSessionToken(now));
    assert.equal(token.includes(env.ADMIN_PASSWORD), false);
    const payload = token.split(".");
    assert.equal(payload[1], String(now / 1000 + session.SESSION_MAX_AGE));
    const changedExpiry = [...payload];
    changedExpiry[1] = String(Number(payload[1]) + 1000);
    const changedNonce = [...payload];
    changedNonce[2] = `${payload[2][0] === "a" ? "b" : "a"}${payload[2].slice(1)}`;
    const changedSignature = [...payload];
    changedSignature[3] = `${payload[3][0] === "a" ? "b" : "a"}${payload[3].slice(1)}`;
    for (const invalid of [undefined, "", "true", "forged", "authenticated_session", env.ADMIN_PASSWORD,
      token + ".extra", "v1.1.x.y", "x".repeat(1000), changedExpiry.join("."), changedNonce.join("."), changedSignature.join(".")]) {
      assert.equal(session.verifySessionToken(invalid, now), false);
    }
    assert.equal(session.verifySessionToken(token, now + session.SESSION_MAX_AGE * 1000 - 1), true);
    assert.equal(session.verifySessionToken(token, now + session.SESSION_MAX_AGE * 1000), false);
    env.ADMIN_PASSWORD = "changed-password";
    assert.equal(session.verifySessionToken(token, now), false);
  });

  test("session secret rotation and missing configuration fail closed", () => {
    const { session, env } = authContext();
    const token = session.createSessionToken();
    env.SESSION_SECRET = "another-secret-with-at-least-32-bytes";
    assert.equal(session.verifySessionToken(token), false);
    for (const secret of [undefined, "short"]) {
      env.SESSION_SECRET = secret;
      assert.equal(session.verifySessionToken(token), false);
      assert.throws(() => session.createSessionToken(), /SESSION_SECRET/);
    }
  });

  test("login issues a secure session cookie instead of persisting the password", async () => {
    const context = authContext();
    const actions = loadSource("src/app/actions/auth.ts", {
      "next/headers": context.headers,
      "next/navigation": { redirect: (url: string) => { throw new Error(`redirect:${url}`); } },
      "@/lib/session": context.session,
    }, { process: { env: { ...context.env, NODE_ENV: "production" } } }) as typeof import("../../src/app/actions/auth");
    const formData = new FormData();
    formData.set("password", context.env.ADMIN_PASSWORD);
    await assert.rejects(actions.login(null, formData), /redirect:\/$/);
    const [name, token, options] = context.writes[0];
    assert.equal(name, "job_auth");
    assert.equal(context.session.verifySessionToken(token), true);
    assert.notEqual(token, context.env.ADMIN_PASSWORD);
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.maxAge, context.session.SESSION_MAX_AGE);
    assert.equal(options.path, "/");
    formData.set("password", "wrong-password");
    const failure = await actions.login(null, formData);
    assert.match(failure.error, /Incorrect password/);
    assert.equal(context.writes.length, 1);
  });

  test("all mutations reject a forged session before accessing database or GitHub", async () => {
    const context = authContext();
    context.setCookie("forged");
    let boundaryCalls = 0;
    const failBoundary = () => { boundaryCalls++; throw new Error("Unauthorized boundary reached"); };
    const prisma = new Proxy({}, { get: failBoundary });
    const common = {
      "@/lib/auth": context.auth,
      "@/lib/prisma": { prisma },
      "next/cache": { revalidatePath: failBoundary },
    };
    const cases: Record<string, Record<string, unknown[]>> = {
      category: { addCategory: ["Test", "react"], updateCategory: ["id", "Test", "react"], deleteCategory: ["id"] },
      scraperUrl: { addScraperUrl: ["https://justjoin.it"], updateScraperUrl: ["id", "https://justjoin.it", "Test"], deleteScraperUrl: ["id"], toggleScraperUrl: ["id", true] },
      workPreference: { addWorkPreference: ["Remote", "remote"], updateWorkPreference: ["id", "Remote", "remote", true], deleteWorkPreference: ["id"], toggleWorkPreference: ["id", true] },
      scraper: { triggerScraperAction: [] },
    };
    for (const [file, calls] of Object.entries(cases)) {
      const actions = loadSource(`src/app/actions/${file}.ts`, common) as Record<string, (...args: unknown[]) => Promise<unknown>>;
      for (const [name, args] of Object.entries(calls)) {
        await assert.rejects(actions[name](...args), /Unauthorized access/);
      }
    }
    assert.equal(boundaryCalls, 0);
  });

  test("dashboard, protected pages and Proxy validate the same session", async () => {
    const context = authContext();
    let reads = 0;
    const findMany = async () => { reads++; return []; };
    const jsx = (type: unknown, props: unknown) => ({ type, props });
    const common = {
      "@/lib/auth": context.auth,
      "@/lib/prisma": { prisma: {
        category: { findMany }, workPreference: { findMany }, scraperUrl: { findMany }, job: { findMany }, scrapeHistory: { findMany },
      } },
      "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": () => {}, "lucide-react": {},
      "next/navigation": { redirect: (url: string) => { throw new Error(`redirect:${url}`); } },
      "@/components/ui/button": {}, "@/components/RunScraperButton": {}, "@/lib/utils": {},
      "@/components/CategoriesManager": {}, "@/components/ScraperUrlsManager": {},
      "@/components/WorkPreferencesManager": {}, "@/components/ui/tabs": {},
    };
    const home = (loadSource("src/app/page.tsx", common) as typeof import("../../src/app/page")).default;
    const settings = (loadSource("src/app/settings/page.tsx", common) as typeof import("../../src/app/settings/page")).default;
    const history = (loadSource("src/app/history/page.tsx", common) as typeof import("../../src/app/history/page")).default;
    const proxy = (loadSource("src/proxy.ts", {
      "@/lib/session": context.session,
      "next/server": { NextResponse: { next: () => "allowed", redirect: () => "redirected" } },
    }) as { proxy: (input: ReturnType<typeof request>) => string }).proxy;
    const request = (value: string | undefined, pathname: string) => ({ cookies: { get: () => ({ value }) }, nextUrl: { pathname }, url: `https://example.test${pathname}` });
    const valid = context.session.createSessionToken();
    for (const invalid of [undefined, "forged", context.env.ADMIN_PASSWORD, context.session.createSessionToken(0)]) {
      context.setCookie(invalid);
      await home({ searchParams: Promise.resolve({}) });
      await assert.rejects(settings(), /redirect:\/login/);
      await assert.rejects(history(), /redirect:\/login/);
      assert.equal(proxy(request(invalid, "/settings")), "redirected");
    }
    assert.equal(reads, 0);
    context.setCookie(valid);
    await context.auth.verifyAuth();
    await home({ searchParams: Promise.resolve({}) });
    await settings();
    await history();
    assert.equal(reads, 8);
    assert.equal(proxy(request(valid, "/settings")), "allowed");
    assert.equal(proxy(request(valid, "/login")), "redirected");
    assert.equal(proxy(request(undefined, "/")), "allowed");
  });
});
