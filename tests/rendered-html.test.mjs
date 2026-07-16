import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://ai-comp-decoded.example/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the AI-Comp explainer and social metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>AI-Comp Decoded/);
  assert.match(html, /How a compiler/);
  assert.match(html, /Intent in\./);
  assert.match(html, /Eight moves\./);
  assert.match(html, /See the compiler/);
  assert.match(html, /Data movement/);
  assert.match(html, /Dependency → schedule/);
  assert.match(html, /CODE, BEFORE AND AFTER/);
  assert.match(html, /SLP vectorization/);
  assert.match(html, /8 scalar additions/);
  assert.match(html, /PERFORMANCE CONTEXT/);
  assert.match(html, /REVIEWED SOURCES/);
  assert.match(html, /Anthropic original performance take-home/);
  assert.match(html, /LLVM auto-vectorization documentation/);
  assert.match(html, /WHY VLIW IS THE ENDGAME/);
  assert.match(html, /https:\/\/github\.com\/fiigii\/ai-comp/);
  assert.match(html, /property="og:image" content="https?:\/\/[^\"]+\/og\.png"/);
});

test("ships the finished interactive source and social card", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(page, /useState/);
  assert.match(page, /HIR/);
  assert.match(page, /SLP ×8/);
  assert.match(page, /Safe load forwarding/);
  assert.match(page, /Multiply-add synthesis/);
  assert.match(page, /Dependency-aware bundling/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /x-forwarded-host/);
  assert.match(packageJson, /"name": "ai-comp-explained"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
