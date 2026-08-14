import { readFile } from "node:fs/promises";

const originArgument = process.argv.find((argument) => argument.startsWith("--origin="));
const origin = (originArgument?.slice("--origin=".length) || "https://docs.praxa.io").replace(/\/$/, "");
const docs = JSON.parse(await readFile(new URL("../docs.json", import.meta.url), "utf8"));

function collectPages(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) for (const item of value) collectPages(item, output);
  else if (value && typeof value === "object") {
    if (typeof value.root === "string") output.push(value.root);
    if (value.pages) collectPages(value.pages, output);
    if (value.groups) collectPages(value.groups, output);
    if (value.tabs) collectPages(value.tabs, output);
  }
  return output;
}

function canonicalPagePath(page) {
  if (page === "index") return "";
  return page.endsWith("/index") ? page.slice(0, -"/index".length) : page;
}

async function get(pathname, expectedType) {
  const response = await fetch(`${origin}${pathname}`, {
    headers: { "user-agent": "praxa-docs-release-verifier/1.0" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (expectedType && !contentType.includes(expectedType)) {
    throw new Error(`${pathname} returned ${contentType || "no content type"}; expected ${expectedType}`);
  }
  return { body: await response.text(), contentType };
}

const [index, full, wellKnown, wellKnownFull, robots, sitemap] = await Promise.all([
  get("/llms.txt", "text/plain"),
  get("/llms-full.txt", "text/plain"),
  get("/.well-known/llms.txt", "text/plain"),
  get("/.well-known/llms-full.txt", "text/plain"),
  get("/robots.txt", "text/plain"),
  get("/sitemap.xml", "text/xml"),
]);

if (!index.body.startsWith("# Praxa")) throw new Error("/llms.txt does not identify Praxa");
if (!full.body.includes("Source: https://docs.praxa.io/")) throw new Error("/llms-full.txt has no Praxa source markers");
if (wellKnown.body !== index.body) throw new Error("/.well-known/llms.txt differs from /llms.txt");
if (wellKnownFull.body !== full.body) throw new Error("/.well-known/llms-full.txt differs from /llms-full.txt");
if (!robots.body.includes(`Sitemap: ${origin}/sitemap.xml`)) throw new Error("robots.txt does not advertise the sitemap");

const pages = [...new Set(collectPages(docs.navigation))].sort();
for (const page of pages) {
  const markdownUrl = `${origin}/${page}.md`;
  if (!index.body.includes(markdownUrl)) throw new Error(`/llms.txt is missing ${markdownUrl}`);
  if (!full.body.includes(`Source: ${origin}/${page}`)) throw new Error(`/llms-full.txt is missing ${page}`);
  const canonicalPath = canonicalPagePath(page);
  const sitemapUrl = canonicalPath ? `${origin}/${canonicalPath}` : origin;
  if (!sitemap.body.includes(`<loc>${sitemapUrl}</loc>`)) throw new Error(`/sitemap.xml is missing ${sitemapUrl}`);
}

const queue = [...pages];
const failures = [];
await Promise.all(Array.from({ length: 10 }, async () => {
  while (queue.length) {
    const page = queue.shift();
    try {
      const result = await get(`/${page}.md`, "text/markdown");
      if (!result.body.includes("# ")) throw new Error("Markdown has no page heading");
      if (!result.body.includes("Fetch the complete documentation index")) {
        throw new Error("Markdown does not advertise /llms.txt");
      }
    } catch (error) {
      failures.push(`${page}: ${error.message}`);
    }
  }
}));

if (failures.length) throw new Error(`Live LLM export verification failed:\n- ${failures.join("\n- ")}`);
console.log(`Live LLM discovery passed for ${pages.length} navigable pages at ${origin}.`);
