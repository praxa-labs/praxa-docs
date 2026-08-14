import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const catalog = JSON.parse(
  await readFile(path.join(root, "data/public-capabilities.json"), "utf8"),
);

const statusLabels = {
  live: "Live",
  beta: "Beta",
  "partner-preview": "Partner preview",
  "deployment-specific": "Deployment-specific",
  "qualification-preview": "Qualification preview",
};

const categoryCopy = {
  "core-chat": {
    description: "Understand the model, reasoning, attachment, and rendered-result capabilities available in Praxa chat.",
    boundary: "These are Praxa application capabilities. A listed chat capability does not create a public API unless the Capability Atlas links to a developer service.",
    examples: [
      ["Compare two model lanes", "Switch models for the same bounded question and compare the visible response and thinking controls."],
      ["Analyze an attachment", "Attach a supported document or image and ask Praxa to identify the evidence it used."],
      ["Inspect a tool result", "Ask for current information and confirm the result appears as a purpose-built card rather than raw JSON."],
      ["Check runtime honesty", "Ask which capabilities are available in the current runtime and confirm unsupported actions are not presented as available."],
    ],
  },
  "agent-runtimes": {
    description: "Choose the Praxa surface that matches connectivity, privacy, input mode, and device support.",
    boundary: "Voice, on-device, iMessage, widget, and application catalog surfaces are product experiences. They are not interchangeable with Execution Fabric or Integration Gateway credentials.",
    examples: [
      ["Move from text to voice", "Start a supported voice conversation and verify that the available capabilities match the voice runtime."],
      ["Use an offline turn", "On a supported Apple Intelligence device, disconnect from the network and run an on-device request."],
      ["Find a packaged workflow", "Open the Apps, Skills, and Workflows catalog and inspect the requirements before starting one."],
      ["Check a widget surface", "Add a Praxa widget and confirm its displayed information matches the signed-in account."],
    ],
  },
  "memory-personalization": {
    description: "Learn how Praxa remembers, adapts, explains learned context, and keeps correction or consent with the owner.",
    boundary: "Persistent memory and AHCE are Praxa product capabilities. Use @praxa/sdk/memory for read-only provider federation; AHCE is not a public ingestion endpoint.",
    examples: [
      ["Correct a durable memory", "Open Memory settings, change or delete an owner-visible memory, and verify future recall respects the correction."],
      ["Capture a goal", "State a concrete goal in cloud text chat and review the proposed goal record before accepting it."],
      ["Review adaptive context", "Open Adaptive Context, inspect the learned rhythm, and submit a correction or abstention."],
      ["Federate an existing store", "Use the memory federation tutorial to query an existing provider without migrating it."],
    ],
  },
  "research-media": {
    description: "Use Praxa to gather current evidence and turn it into documents, media, presentations, or interactive artifacts.",
    boundary: "Generated artifacts and research outputs require inspection. A rendered result is not independent verification of every underlying claim.",
    examples: [
      ["Research a current decision", "Ask for a multi-source comparison and inspect every cited source before using the conclusion."],
      ["Turn evidence into a document", "Generate a document from supplied sources and download the resulting artifact."],
      ["Create a presentation", "Request a concise deck, then inspect slide copy, media attribution, and export."],
      ["Build an interactive explainer", "Describe a small interactive experience and test the published controls on compact and wide screens."],
    ],
  },
  "browser-computer": {
    description: "Understand when Praxa can read a page, continue a browser session, or hand control to you for credentials.",
    boundary: "Browser actions remain governed by the current approval and credential boundary. A connected account does not grant every possible provider action.",
    examples: [
      ["Continue a browser task", "Ask Praxa to revisit a page in the same conversation and verify the session context is preserved."],
      ["Complete a login handoff", "Take control for credential entry and confirm the model never receives the secret value."],
      ["Approve a browser action", "Inspect the exact target and action before allowing a state-changing browser step."],
      ["Prefer extraction for reading", "Ask for page content and confirm Praxa uses a read path rather than an unnecessary interactive session."],
    ],
  },
  "commerce-actions": {
    description: "Research products, meals, travel, and connected-device actions while keeping purchase or control consequences explicit.",
    boundary: "Research and preparation do not imply autonomous purchase authority. AgentCard remains beta, and travel booking uses an explicit handoff.",
    examples: [
      ["Compare products", "Ask for a criteria-based comparison and inspect the cited price and availability sources."],
      ["Plan a meal", "Build a meal plan and use the supported approval-gated ordering handoff if available."],
      ["Prepare a trip", "Compare itinerary options, then complete booking yourself through the provided handoff."],
      ["Control a device", "Ask for the current smart-home state, then approve the exact supported change."],
    ],
  },
  communication: {
    description: "Use Praxa across agent email, unified inbox triage, and operational task or invoice views.",
    boundary: "Account availability and admitted provider actions are checked at runtime. Drafting, sending, labeling, and archiving are different authorities.",
    examples: [
      ["Triage connected inboxes", "Group new messages by urgency and inspect the account associated with every result."],
      ["Draft before sending", "Ask for a reply draft and confirm no message sends until the exact send action is approved."],
      ["Inspect an agent task", "Open Agent Hub and follow a task from its current state to its linked evidence."],
      ["Review an invoice exception", "Inspect extracted invoice details and keep payment or ledger mutation outside the review step."],
    ],
  },
  automations: {
    description: "Create recurring work, monitor conditions, plan longer goals, and inspect proactive results.",
    boundary: "Scheduling a job defines future work; it does not pre-authorize every external effect that work may propose.",
    examples: [
      ["Schedule a digest", "Create a recurring digest with an explicit schedule, source scope, and delivery destination."],
      ["Monitor a condition", "Watch a price or page condition and verify a notification is emitted only when the condition is met."],
      ["Check plan feasibility", "Give Praxa a set of tasks and time constraints and inspect the arithmetic behind the answer."],
      ["Review a daily briefing", "Open the day-start brief and follow each item back to its current calendar, task, or message source."],
    ],
  },
  "custom-agents": {
    description: "Build, specialize, and coordinate Praxa agents while keeping identity, skills, and runtime availability explicit.",
    boundary: "Specialist agents are beta. A custom agent's instructions do not bypass tool admission, approval, or provider capability checks.",
    examples: [
      ["Create a custom agent", "Define its identity and instructions, then run the Preview requirements before publishing."],
      ["Attach a skill", "Add a reusable skill and verify the agent can discover it only on supported surfaces."],
      ["Fan out research", "Run parallel sub-agents over separate research angles and inspect the combined evidence."],
      ["Try a specialist", "Use an available specialist agent and keep its beta limitations visible in the result."],
    ],
  },
  "teams-organizations": {
    description: "Coordinate people and agents across conversations, channels, organizations, billing, and social surfaces.",
    boundary: "Product organization membership and public developer-key tenancy are separate contracts. Do not infer API authority from a product role alone.",
    examples: [
      ["Run a multi-user conversation", "Invite participants and verify everyone sees the same scoped conversation and agent output."],
      ["Use a team channel", "Ask Praxa for a channel summary and confirm it only uses content visible to the current member."],
      ["Review organization usage", "Open the organization usage view and verify the selected workspace and reporting period."],
      ["Manage a subscription", "Change a plan through the platform-specific billing surface and confirm the resulting entitlement."],
    ],
  },
  "device-context": {
    description: "Use consented health, location, calendar, and contact context on the surfaces that support it.",
    boundary: "Device permissions remain authoritative. Web surfaces may degrade when the corresponding native capability is unavailable.",
    examples: [
      ["Summarize authorized health data", "Ask for a bounded activity or sleep summary and verify the requested Health permission is active."],
      ["Find a nearby place", "Use current location to search nearby places and inspect the returned map or place details."],
      ["Manage a calendar item", "Review the exact account, time, attendees, and action before creating or changing an event."],
      ["Resolve a contact", "Draft a message to a named contact and verify the resolved recipient before sending."],
    ],
  },
};

function titleCaseStatus(status) {
  return statusLabels[status] || status;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function frontmatter(title, sidebarTitle, description) {
  return [
    "---",
    "title: \"" + title.replaceAll('"', '\\"') + "\"",
    "sidebarTitle: \"" + sidebarTitle.replaceAll('"', '\\"') + "\"",
    "description: \"" + description.replaceAll('"', '\\"') + "\"",
    "---",
    "",
  ].join("\n");
}

function generatedNotice() {
  return "{/* Generated from data/public-capabilities.json. Run npm run docs:generate after changing the catalog. */}\n\n";
}

async function writeOrCheck(relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  const normalized = content.endsWith("\n") ? content : content + "\n";
  if (checkOnly) {
    let current = "";
    try {
      current = await readFile(absolutePath, "utf8");
    } catch {
      throw new Error(relativePath + " is missing; run npm run docs:generate");
    }
    if (current !== normalized) {
      throw new Error(relativePath + " is stale; run npm run docs:generate");
    }
    return;
  }
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, normalized, "utf8");
}

function renderAtlas() {
  const lines = [
    frontmatter(
      "Praxa Capability Atlas",
      "Capability Atlas",
      "See every supported developer service and provided Praxa product capability without confusing product availability with public API access.",
    ),
    generatedNotice(),
    "Use this atlas to answer two separate questions: **what can Praxa do on its product surfaces**, and **what can your application call through a documented developer contract**.",
    "",
    "```mermaid",
    "flowchart LR",
    "  Need[\"What do you need?\"] --> Build[\"Build with Praxa\"]",
    "  Need --> Use[\"Use Praxa\"]",
    "  Build --> API[\"REST APIs and Playground\"]",
    "  Build --> Packages[\"SDK, CLI, and MCP contracts\"]",
    "  Build --> Federation[\"Memory federation\"]",
    "  Use --> Product[\"Praxa application capabilities\"]",
    "  Product --> Native[\"iOS, voice, on-device, and device context\"]",
    "  Product --> Cloud[\"Web, chat, agents, teams, and automations\"]",
    "```",
    "",
    "<Warning>",
    "A product capability is not automatically a public API. Follow the linked developer service when one exists. Keep Execution Fabric API keys, Integration Gateway OAuth tokens, and provider credentials in their documented boundaries.",
    "</Warning>",
    "",
    "## Developer services",
    "",
    "| Service | Availability | Surface | Authentication | Start |",
    "|---|---|---|---|---|",
  ];

  for (const service of catalog.developerServices) {
    lines.push(
      "| **" + escapeCell(service.name) + "**<br />" + escapeCell(service.summary) +
        " | " + escapeCell(titleCaseStatus(service.status)) +
        " | " + escapeCell(service.surface) +
        " | " + escapeCell(service.auth) +
        " | [Overview](" + service.overview + ") · [Tutorial](" + service.quickstart + ") · [Reference](" + service.reference + ")" + (service.playground ? " · [Playground](" + service.playground + ")" : "") + " |",
    );
  }

  lines.push(
    "",
    "## Praxa product capabilities",
    "",
    "These capabilities are grouped by the product job they support. Each guide includes example outcomes and the runtime boundary you should verify.",
    "",
    "<CardGroup cols={2}>",
  );

  for (const category of catalog.categories) {
    const count = catalog.productCapabilities.filter((item) => item.category === category.id).length;
    lines.push(
      "  <Card title=\"" + category.name + "\" icon=\"book-open\" href=\"" + category.guide + "\">",
      "    " + count + " provided capabilities with examples and supported surfaces.",
      "  </Card>",
    );
  }
  lines.push("</CardGroup>", "");

  for (const category of catalog.categories) {
    const items = catalog.productCapabilities.filter((item) => item.category === category.id);
    lines.push("### [" + category.name + "](" + category.guide + ")", "");
    lines.push("| Capability | Status | Surfaces | What it does |", "|---|---|---|---|");
    for (const item of items) {
      lines.push(
        "| " + escapeCell(item.name) + " | " + escapeCell(titleCaseStatus(item.status)) + " | " + escapeCell(item.surfaces.join(", ")) + " | " + escapeCell(item.summary) + " |",
      );
    }
    lines.push("");
  }

  lines.push(
    "## Status boundaries",
    "",
    "- **Live** means the capability is available on at least one listed Praxa product or package surface.",
    "- **Beta** means it is reachable only in the documented opt-in, cohort, or sandbox.",
    "- **Partner preview** is not general availability.",
    "- **Deployment-specific** means your organization must operate or receive an Integration Gateway origin and OAuth flow.",
    "- **Qualification preview** means source and deployment exist, but authenticated production proof is still incomplete.",
    "",
    "Capabilities that are building, dark, parked, or removed are intentionally absent from the provided-capability catalog. See [Service status](/overview/service-status) for the public release model.",
  );
  return lines.join("\n");
}

function renderServiceStatus() {
  const lines = [
    frontmatter(
      "Service status and proof boundaries",
      "Service status",
      "Understand which Praxa developer surfaces are live packages, partner previews, deployment-specific contracts, or qualification previews.",
    ),
    generatedNotice(),
    "Praxa reports package publication, deployed API reachability, authenticated qualification, and product availability as separate facts.",
    "",
    "```mermaid",
    "flowchart LR",
    "  Source[\"Source implemented\"] --> Package[\"Package published\"]",
    "  Source --> Deploy[\"Service deployed\"]",
    "  Deploy --> Auth[\"Authenticated canary\"]",
    "  Auth --> User[\"User-verified workflow\"]",
    "  Package -. does not prove .-> Deploy",
    "  Deploy -. does not prove .-> User",
    "```",
    "",
    "## Current developer surfaces",
    "",
    "| Surface | Status | What the status proves | What it does not prove |",
    "|---|---|---|---|",
  ];
  for (const service of catalog.developerServices) {
    let limitation = "Availability outside the listed surface, credential, tenant, or deployment boundary.";
    if (service.status === "live") limitation = "That a separate runtime service is deployed or that your credential has authority.";
    if (service.status === "partner-preview") limitation = "General availability or organization-tenant support.";
    if (service.status === "deployment-specific") limitation = "A public shared Gateway origin or token issuer.";
    if (service.status === "qualification-preview") limitation = "Authenticated positive, wrong-scope, revoked-key, or cross-tenant qualification.";
    lines.push(
      "| [" + escapeCell(service.name) + "](" + service.overview + ") | " + escapeCell(titleCaseStatus(service.status)) + " | " + escapeCell(service.summary) + " | " + escapeCell(limitation) + " |",
    );
  }
  lines.push(
    "",
    "## Publication policy",
    "",
    "- A package is **live** only when the named version is publicly installable and its clean-install import succeeds.",
    "- An API is **deployed** only when its production route and authentication boundary are observed.",
    "- A workflow is **qualified** only after its required authenticated positive and negative cases run against the intended tenant boundary.",
    "- A Praxa product capability is **live** only on the surfaces listed in the Capability Atlas.",
    "- Building, dark, parked, and removed work never appears as a normal happy-path integration.",
    "",
    "<Note>",
    "Deployment revisions and engineering receipts belong in operational release records. User-facing guides show the public status, supported version, and actionable limitation instead of implementation details.",
    "</Note>",
  );
  return lines.join("\n");
}

function renderProductOverview() {
  const lines = [
    frontmatter(
      "Praxa product guides",
      "Product guides",
      "Learn what Praxa provides across chat, memory, research, browser automation, communication, agents, teams, and device context.",
    ),
    generatedNotice(),
    "Product guides explain what a person can do in Praxa. They do not imply a public REST, SDK, CLI, or MCP interface unless they link back to a named developer service.",
    "",
    "<CardGroup cols={2}>",
  ];
  for (const category of catalog.categories) {
    const count = catalog.productCapabilities.filter((item) => item.category === category.id).length;
    lines.push(
      "  <Card title=\"" + category.name + "\" icon=\"book-open\" href=\"" + category.guide + "\">",
      "    Explore " + count + " provided capabilities, example outcomes, supported surfaces, and runtime boundaries.",
      "  </Card>",
    );
  }
  lines.push(
    "</CardGroup>",
    "",
    "## Choose a developer contract",
    "",
    "If you are building software rather than using a Praxa application surface, start with the [Capability Atlas](/overview/capabilities) or [Choose your path](/overview/choose-your-path). Those pages route you only to supported public contracts.",
  );
  return lines.join("\n");
}

function renderCategoryPage(category) {
  const copy = categoryCopy[category.id];
  const items = catalog.productCapabilities.filter((item) => item.category === category.id);
  const lines = [
    frontmatter(category.name, category.name, copy.description),
    generatedNotice(),
    copy.description,
    "",
    "<Note>",
    copy.boundary,
    "</Note>",
    "",
    "## Provided capabilities",
    "",
    "| Capability | Status | Surfaces | Who it helps |",
    "|---|---|---|---|",
  ];
  for (const item of items) {
    lines.push(
      "| **" + escapeCell(item.name) + "**<br />" + escapeCell(item.summary) + " | " + escapeCell(titleCaseStatus(item.status)) + " | " + escapeCell(item.surfaces.join(", ")) + " | " + escapeCell(item.audiences.join(", ")) + " |",
    );
  }
  lines.push("", "## Example outcomes", "");
  let index = 1;
  for (const [title, description] of copy.examples) {
    lines.push(index + ". **" + title + ".** " + description);
    index += 1;
  }
  lines.push(
    "",
    "## Verify the surface",
    "",
    "1. Confirm the capability status and listed surface in the [Capability Atlas](/overview/capabilities).",
    "2. Sign in to the intended Praxa product surface and select the correct personal or organization workspace.",
    "3. Exercise the example with the smallest safe scope and inspect the visible result or approval card.",
    "4. Test one unavailable, denied, or disconnected state so the surface fails honestly.",
    "5. Use a developer tutorial only when this guide links to a supported public developer contract.",
  );
  if (category.id === "memory-personalization") {
    lines.push(
      "",
      "<Card title=\"Integrate existing memory\" icon=\"database\" href=\"/memory-federation/overview\">",
      "  Use read-only federation when your backend already owns a supported memory provider. This does not write into AHCE or Praxa personal memory.",
      "</Card>",
    );
  }
  return lines.join("\n");
}

await writeOrCheck("overview/capabilities.mdx", renderAtlas());
await writeOrCheck("overview/service-status.mdx", renderServiceStatus());
await writeOrCheck("product-guides/overview.mdx", renderProductOverview());
for (const category of catalog.categories) {
  const relative = category.guide.slice(1) + ".mdx";
  await writeOrCheck(relative, renderCategoryPage(category));
}

console.log(
  (checkOnly ? "Verified" : "Generated") +
    " capability docs for " +
    catalog.developerServices.length +
    " developer services and " +
    catalog.productCapabilities.length +
    " product capabilities.",
);
