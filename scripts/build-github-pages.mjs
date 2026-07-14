import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const base = "/AI_compiler";
const origin = "https://buicongnguyen.github.io";
const output = new URL("../docs/", import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("../dist/client/", import.meta.url), output, { recursive: true });

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("pages-export", Date.now().toString());
const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request(`${origin}/`, {
    headers: {
      accept: "text/html",
      "x-forwarded-host": "buicongnguyen.github.io",
      "x-forwarded-proto": "https",
    },
  }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);

if (!response.ok) throw new Error(`Static render failed: ${response.status}`);

let html = await response.text();
html = html
  .replace(/<style data-vinext-fonts>[\s\S]*?<\/style>/, "")
  .replaceAll('"/assets/', `"${base}/assets/`)
  .replaceAll('"/favicon.svg', `"${base}/favicon.svg`)
  .replaceAll('http://localhost:3000/og.png', `${origin}${base}/og.png`)
  .replaceAll('http://localhost:3000/favicon.svg', `${origin}${base}/favicon.svg`)
  .replaceAll(`${origin}/og.png`, `${origin}${base}/og.png`)
  .replaceAll(`${origin}/favicon.svg`, `${origin}${base}/favicon.svg`)
  .replace('"pathname":"/"', `"pathname":"${base}/"`);

await writeFile(new URL("index.html", output), html, "utf8");
await writeFile(new URL("404.html", output), html, "utf8");
await writeFile(new URL(".nojekyll", output), "", "utf8");

const check = await readFile(new URL("index.html", output), "utf8");
for (const required of ["AI-Comp Decoded", `${base}/assets/`, `${origin}${base}/og.png`]) {
  if (!check.includes(required)) throw new Error(`Static export is missing: ${required}`);
}

console.log(`GitHub Pages export ready at docs${base}`);
