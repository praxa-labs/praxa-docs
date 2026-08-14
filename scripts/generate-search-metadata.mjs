import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const profiles = [
  ["api-playground/", ["Praxa API Playground", "Praxa API examples", "API authentication"]],
  ["api-reference/", ["Praxa API reference", "Praxa Integration Gateway", "OAuth API"]],
  ["mcp/", ["Praxa MCP", "Model Context Protocol", "AI agent tools"]],
  ["sdk/", ["Praxa TypeScript SDK", "AI agent SDK", "Praxa SDK"]],
  ["cli/", ["Praxa CLI", "AI agent command line", "Praxa automation"]],
  ["benchmarks/", ["Praxa benchmarks", "AI agent evaluation", "reproducible benchmarks"]],
  ["tutorials/", ["Praxa tutorials", "AI integration guide", "developer tutorial"]],
  ["fabric/", ["Praxa Execution Fabric", "governed AI agents", "durable AI tasks"]],
  ["memory-federation/", ["AI agent memory", "memory federation", "Praxa memory"]],
  ["use-cases/", ["Praxa use cases", "AI agent workflows", "business automation"]],
  ["product-guides/", ["Praxa product guide", "AI agent capabilities", "Praxa AI"]],
  ["operations/", ["Praxa operations", "AI agent observability", "production readiness"]],
  ["troubleshooting/", ["Praxa troubleshooting", "AI integration errors", "developer support"]],
  ["releases/", ["Praxa release notes", "API compatibility", "migration guide"]],
  ["concepts/", ["Praxa concepts", "governed AI agents", "agent architecture"]],
  ["overview/", ["Praxa developer platform", "Praxa documentation", "AI agent platform"]],
];

async function walk(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "snippets"].includes(entry.name)) continue;
    const relative = path.join(directory, entry.name).replace(/^\.\//, "");
    if (entry.isDirectory()) files.push(...(await walk(relative)));
    else if (entry.name.endsWith(".mdx")) files.push(relative);
  }
  return files;
}

function keywordsFor(file, title) {
  const profile = profiles.find(([prefix]) => file.startsWith(prefix))?.[1] || [
    "Praxa developer platform",
    "governed AI agents",
    "Praxa documentation",
  ];
  const specific = title.toLowerCase().includes("praxa") ? title : `Praxa ${title}`;
  return [...new Set([specific, ...profile])].slice(0, 4);
}

function updateFrontmatter(file, content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file} has no frontmatter`);
  const frontmatter = match[1];
  const title = frontmatter.match(/^title:\s*["']?(.*?)["']?\s*$/m)?.[1];
  const description = frontmatter.match(/^description:\s*["']?(.*?)["']?\s*$/m)?.[1];
  if (!title || !description) throw new Error(`${file} needs title and description before keyword generation`);
  const keywords = `keywords: ${JSON.stringify(keywordsFor(file, title))}`;
  const nextFrontmatter = /^keywords:/m.test(frontmatter)
    ? frontmatter.replace(/^keywords:.*$/m, keywords)
    : frontmatter.replace(/^description:.*$/m, (line) => `${line}\n${keywords}`);
  return content.replace(match[0], `---\n${nextFrontmatter}\n---`);
}

let updated = 0;
for (const file of await walk(".")) {
  const absolute = path.join(root, file);
  const current = await readFile(absolute, "utf8");
  const next = updateFrontmatter(file, current);
  if (next === current) continue;
  if (checkOnly) throw new Error(`${file} has stale search metadata; run npm run docs:generate`);
  await writeFile(absolute, next, "utf8");
  updated += 1;
}

console.log(`${checkOnly ? "Checked" : "Updated"} search metadata for ${updated || "all"} documentation pages.`);
