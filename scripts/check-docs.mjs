import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function walk(directory, extension) {
  const absolute = path.join(root, directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if ([".git", "node_modules"].includes(entry.name)) continue;
    if (entry.isDirectory()) files.push(...(await walk(relative, extension)));
    else if (!extension || entry.name.endsWith(extension)) files.push(relative.replace(/^\.\//, ""));
  }
  return files;
}

async function routeExists(route) {
  const normalized = route.replace(/^\//, "").replace(/[?#].*$/, "");
  if (!normalized || normalized.startsWith("images/")) return true;
  const candidates = [normalized + ".mdx", path.join(normalized, "index.mdx")];
  for (const candidate of candidates) {
    if (await exists(candidate)) return true;
  }
  return false;
}

function collectNavigationPages(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNavigationPages(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    if (typeof value.root === "string") output.push(value.root);
    if (value.pages) collectNavigationPages(value.pages, output);
    if (value.groups) collectNavigationPages(value.groups, output);
    if (value.tabs) collectNavigationPages(value.tabs, output);
  }
  return output;
}

function kebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const docsConfig = JSON.parse(await readFile(path.join(root, "docs.json"), "utf8"));
const navigationPages = new Set(collectNavigationPages(docsConfig.navigation));
for (const page of navigationPages) {
  if (!(await routeExists(page))) failures.push("Navigation target is missing: " + page);
}

const playgroundSources = [
  ["fabric/api/openapi.yaml", "api-playground/execution-fabric"],
  ["memory-federation/openapi.yaml", "api-playground/memory"],
];
let playgroundOperationCount = 0;
for (const [specPath, outputDirectory] of playgroundSources) {
  const document = parse(await readFile(path.join(root, specPath), "utf8"));
  for (const [route, pathItem] of Object.entries(document.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "patch", "delete", "put"].includes(method)) continue;
      if (operation["x-hidden"] || operation["x-activation-status"] === "pending") continue;
      playgroundOperationCount += 1;
      const page = `${outputDirectory}/${kebabCase(operation.operationId)}`;
      if (!navigationPages.has(page)) failures.push("Public playground operation is absent from navigation: " + page);
      if (!(await routeExists(page))) {
        failures.push("Public playground operation page is missing: " + page);
        continue;
      }
      const content = await readFile(path.join(root, page + ".mdx"), "utf8");
      if (!content.includes(`api: "${method.toUpperCase()} ${route}"`)) failures.push(page + " does not match its OpenAPI method and route");
      if (!content.includes('playground: "interactive"')) failures.push(page + " does not enable the interactive playground");
    }
  }
}
if (playgroundOperationCount !== 15) failures.push("Expected 15 public playground operations; found " + playgroundOperationCount);

const catalog = JSON.parse(
  await readFile(path.join(root, "data/public-capabilities.json"), "utf8"),
);
const allowedProductStatuses = new Set(["live", "beta"]);
const allowedServiceStatuses = new Set([
  "live",
  "partner-preview",
  "deployment-specific",
  "qualification-preview",
]);
const categoryIds = new Set(catalog.categories.map((category) => category.id));
const ids = new Set();

if (catalog.productCapabilities.length !== 63) {
  failures.push("Expected 63 provided product capabilities; found " + catalog.productCapabilities.length);
}
if (catalog.developerServices.length !== 10) {
  failures.push("Expected 10 developer services; found " + catalog.developerServices.length);
}

for (const category of catalog.categories) {
  if (!(await routeExists(category.guide))) failures.push("Category guide is missing: " + category.guide);
}
for (const capability of catalog.productCapabilities) {
  if (ids.has(capability.id)) failures.push("Duplicate capability id: " + capability.id);
  ids.add(capability.id);
  if (!categoryIds.has(capability.category)) failures.push("Unknown category for " + capability.id);
  if (!allowedProductStatuses.has(capability.status)) failures.push("Non-provided status in public catalog: " + capability.id + " -> " + capability.status);
  if (!capability.summary || !capability.surfaces?.length || !capability.audiences?.length) failures.push("Incomplete product capability: " + capability.id);
}
for (const service of catalog.developerServices) {
  if (ids.has(service.id)) failures.push("Duplicate public id: " + service.id);
  ids.add(service.id);
  if (!allowedServiceStatuses.has(service.status)) failures.push("Unknown developer-service status: " + service.id);
  for (const field of ["overview", "quickstart", "reference"]) {
    if (!service[field] || !(await routeExists(service[field]))) failures.push("Missing " + field + " route for " + service.id + ": " + service[field]);
  }
  if (service.playground && !(await routeExists(service.playground))) failures.push("Missing playground route for " + service.id);
}

const mdxFiles = await walk(".", ".mdx");
let mermaidCount = 0;
let imageCount = 0;
for (const file of mdxFiles) {
  const content = await readFile(path.join(root, file), "utf8");
  mermaidCount += (content.match(/(?:```|~~~)mermaid/g) || []).length;
  const linkPatterns = [/\]\((\/[^)]+)\)/g, /href=["'](\/[^"']+)["']/g];
  for (const pattern of linkPatterns) {
    for (const match of content.matchAll(pattern)) {
      const route = match[1];
      if (route.startsWith("/images/") || route.endsWith(".yaml") || route.endsWith(".json")) continue;
      if (!(await routeExists(route))) failures.push(file + " links to missing route " + route);
    }
  }
  for (const match of content.matchAll(/<img\s+[^>]*>/g)) {
    imageCount += 1;
    if (!/\salt=["'][^"']+["']/.test(match[0])) failures.push(file + " contains an image without alt text");
  }
  const externalFirstDirectories = [
    "api-playground/",
    "operations/",
    "overview/",
    "product-guides/",
    "releases/",
    "troubleshooting/",
    "tutorials/",
  ];
  if (externalFirstDirectories.some((directory) => file.startsWith(directory)) && /\b(?:worktree|ledger\/|service[-_ ]role|security definer|exact deploy(?:ment)? (?:sha|revision)|202[0-9]{11})\b/i.test(content)) {
    failures.push(file + " exposes an internal implementation or receipt term");
  }
}

if (mermaidCount < 12) failures.push("Expected at least 12 Mermaid diagrams; found " + mermaidCount);
if (imageCount < 3) failures.push("Expected at least 3 accessible visual assets; found " + imageCount);

const tutorialFiles = mdxFiles.filter((file) => file.startsWith("tutorials/") && file !== "tutorials/overview.mdx");
if (tutorialFiles.length < 29) {
  failures.push("Expected at least 29 end-to-end tutorial pages; found " + tutorialFiles.length);
}

const frameworkTutorials = [
  "tutorials/typescript.mdx",
  "tutorials/nextjs.mdx",
  "tutorials/nuxt.mdx",
  "tutorials/express.mdx",
  "tutorials/cloudflare-workers.mdx",
  "tutorials/python.mdx",
  "tutorials/fastapi.mdx",
  "tutorials/rust.mdx",
  "tutorials/go.mdx",
  "tutorials/java-spring.mdx",
  "tutorials/dotnet.mdx",
  "tutorials/react-native.mdx",
  "tutorials/swiftui.mdx",
  "tutorials/kotlin.mdx",
];
for (const file of frameworkTutorials) {
  const content = await readFile(path.join(root, file), "utf8");
  for (const heading of ["## Troubleshooting", "## Best practices"]) {
    if (!content.includes(heading)) failures.push(file + " is missing " + heading);
  }
  if (!/(?:^|\n)## .*?(?:test|verify)/iu.test(content)) {
    failures.push(file + " is missing an explicit test or verification section");
  }
}

for (const file of [
  "tutorials/react-native.mdx",
  "tutorials/swiftui.mdx",
  "tutorials/kotlin.mdx",
]) {
  const content = await readFile(path.join(root, file), "utf8");
  if (!/application\s+backend/iu.test(content)) {
    failures.push(file + " does not state the required application-backend boundary");
  }
  if (/https:\/\/api\.praxa\.io/iu.test(content)) {
    failures.push(file + " must not instruct a mobile application to call api.praxa.io directly");
  }
  if (/PRAXA_(?:API_KEY|ACCESS_TOKEN)/u.test(content)) {
    failures.push(file + " must not place a Praxa server credential in mobile application code");
  }
}

const handbookRoutes = [
  "sdk/quickstart",
  "sdk/configuration-and-auth",
  "sdk/agent-tools",
  "sdk/production-checklist",
  "sdk/troubleshooting",
  "sdk/best-practices",
  "cli/getting-started",
  "cli/project-setup",
  "cli/mission-workflows",
  "cli/memory-workflows",
  "cli/automation-and-json",
  "cli/best-practices",
  "benchmarks/catalog",
  "benchmarks/interpreting-results",
  "benchmarks/designing-evaluations",
  "benchmarks/reproduction-workflow",
  "benchmarks/metrics-glossary",
  "benchmarks/evaluation-examples",
  "benchmarks/best-practices",
  "benchmarks/troubleshooting",
  "tutorials/framework-matrix",
];
for (const route of handbookRoutes) {
  if (!navigationPages.has(route)) failures.push("Handbook route is absent from navigation: " + route);
}

const requiredRoutes = [
  "overview/choose-your-path",
  "overview/capabilities",
  "overview/service-status",
  "overview/examples",
  "product-guides/overview",
  "operations/overview",
  "troubleshooting/overview",
  "releases/compatibility",
  "tutorials/nextjs",
  "tutorials/express",
  "tutorials/cloudflare-workers",
  "tutorials/fastapi",
  "tutorials/framework-matrix",
  "tutorials/typescript",
  "tutorials/nuxt",
  "tutorials/python",
  "tutorials/rust",
  "tutorials/go",
  "tutorials/java-spring",
  "tutorials/dotnet",
  "tutorials/react-native",
  "tutorials/swiftui",
  "tutorials/kotlin",
  "tutorials/agent-frameworks",
  "sdk/quickstart",
  "sdk/configuration-and-auth",
  "sdk/agent-tools",
  "sdk/production-checklist",
  "sdk/troubleshooting",
  "sdk/best-practices",
  "cli/getting-started",
  "cli/project-setup",
  "cli/mission-workflows",
  "cli/memory-workflows",
  "cli/automation-and-json",
  "cli/best-practices",
  "benchmarks/catalog",
  "benchmarks/interpreting-results",
  "benchmarks/designing-evaluations",
  "benchmarks/reproduction-workflow",
  "benchmarks/metrics-glossary",
  "benchmarks/evaluation-examples",
  "benchmarks/best-practices",
  "benchmarks/troubleshooting",
  "benchmarks/methodology",
  "benchmarks/data-and-reproduction",
];
for (const route of requiredRoutes) {
  if (!(await routeExists(route))) failures.push("Required documentation route is missing: " + route);
}

if (failures.length > 0) {
  console.error("Documentation checks failed:\n- " + [...new Set(failures)].join("\n- "));
  process.exit(1);
}

console.log(
  "Documentation checks passed: " +
    mdxFiles.length +
    " MDX files, " +
    mermaidCount +
    " Mermaid diagrams, " +
    imageCount +
    " accessible images, " +
    tutorialFiles.length +
    " tutorial pages, " +
    playgroundOperationCount +
    " interactive playground operations, " +
    catalog.developerServices.length +
    " developer services, and " +
    catalog.productCapabilities.length +
    " product capabilities.",
);
