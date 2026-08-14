import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const prerequisiteStart = "{/* BEGIN GENERATED TUTORIAL PREREQUISITES */}";
const prerequisiteEnd = "{/* END GENERATED TUTORIAL PREREQUISITES */}";
const operationsStart = "{/* BEGIN GENERATED TUTORIAL OPERATIONS */}";
const operationsEnd = "{/* END GENERATED TUTORIAL OPERATIONS */}";

const profiles = {
  backend: {
    prerequisites: [
      "a trusted server runtime and application authentication boundary",
      "a disposable personal workspace Praxa key with only the tutorial's required scopes",
      "synthetic input plus a persisted application request ID for replay tests",
      "a fake upstream for unit tests and a non-production environment for canaries",
    ],
    troubleshooting: [
      ["Browser can see a Praxa key", "Move every Praxa call into the authenticated backend and rebuild the client bundle."],
      ["Timeout may have admitted work", "Reuse the exact stored body and idempotency key, then reconcile the run."],
      ["Unexpected `403`", "Verify personal workspace ownership and the exact endpoint scopes."],
      ["Upstream details reach users", "Map problems to a bounded application error and log only safe identifiers."],
    ],
    best: [
      "Authenticate, rate-limit, and validate a bounded body before calling Praxa.",
      "Derive tenant and subject from the application session, never client input.",
      "Reuse clients and connection pools; set connect, request, and total deadlines.",
      "Persist request identity before the first mutation and reconcile ambiguous outcomes.",
      "Scan production client assets and telemetry for credential-shaped values.",
    ],
    optimize: [
      "Reuse one configured HTTP or SDK client per process and bound concurrent upstream work.",
      "Prefer durable admission plus asynchronous readback over holding application requests open.",
      "Cache only non-sensitive, tenant-scoped reads within their documented freshness window.",
      "Measure p50/p95 latency, admission-to-terminal time, retries, conflicts, and connection reuse before tuning.",
    ],
    cleanup: [
      "Revoke the disposable Praxa key and require a later request to fail.",
      "Remove synthetic application records and any temporary environment files.",
      "Cancel or archive unresolved test runs according to the application policy.",
      "Retain only redacted request, run, and verification identifiers needed for the test record.",
    ],
    credentialAnswer: "No. Browser and mobile bundles are inspectable. Keep the Praxa credential in the trusted application backend.",
    metrics: "application auth failures, upstream status/code, latency, retries, replay conflicts, and terminal run outcomes",
  },
  mobile: {
    prerequisites: [
      "an authenticated application backend that owns the Praxa credential",
      "a reviewed mobile session mechanism and an app-facing bounded API contract",
      "a simulator or emulator plus at least one physical-device test plan",
      "synthetic data and a persisted local request identifier for lifecycle recovery",
    ],
    troubleshooting: [
      ["Praxa key appears in the app", "Revoke it immediately and move the call behind the application backend."],
      ["Backgrounding loses progress", "Persist minimal request/run identity and reconcile when the app becomes active."],
      ["User sees duplicate work", "Create the request ID before the first tap and reuse it across network retries."],
      ["Network error looks like failure", "Represent the outcome as unknown until backend readback confirms state."],
    ],
    best: [
      "Expose only an application-owned contract to the device.",
      "Keep tenant, scopes, provider credentials, and Praxa keys server-derived.",
      "Model loading, admitted, running, unknown, failed, cancelled, and completed states explicitly.",
      "Redact task and memory content from crash reports and analytics.",
      "Test accessibility, slow networks, background/resume, cancellation, and offline recovery on device.",
    ],
    optimize: [
      "Debounce repeated UI actions while preserving the same logical request ID.",
      "Return small app-facing projections and paginate history instead of copying upstream payloads.",
      "Reconcile on foreground with one bounded read rather than restarting the operation.",
      "Measure device-to-backend latency, resume success, duplicate prevention, payload size, and energy impact.",
    ],
    cleanup: [
      "Revoke disposable backend credentials and test application sessions.",
      "Delete synthetic server records and clear test-only secure-storage entries.",
      "Remove captured screenshots, logs, and crash reports containing synthetic payloads.",
      "Record physical-device, background, and recovery checks separately from unit tests.",
    ],
    credentialAnswer: "No. The application calls its own authenticated backend; the backend owns every Praxa and provider credential.",
    metrics: "mobile request latency, background/resume recovery, duplicate suppression, app-facing errors, and terminal readback",
  },
  agent: {
    prerequisites: [
      "the exact published Praxa package versions used by the tutorial",
      "a trusted agent host with explicit tool, approval, timeout, and output policies",
      "deployment-specific OAuth or backend-owned provider clients where the selected lane requires them",
      "synthetic tenant, subject, prompt, and tool fixtures for positive and adversarial tests",
    ],
    troubleshooting: [
      ["Package imports but nothing executes", "Separate package contracts from the deployment or provider executor they describe."],
      ["Agent selects the wrong tool", "Shrink the allowlist and improve the specific tool description and task policy."],
      ["Mutation repeats after timeout", "Persist the exact input and idempotency key, then reconcile before a new call."],
      ["Tool output changes agent intent", "Treat tool content as untrusted data and preserve the original purpose and approval boundary."],
    ],
    best: [
      "Enable the smallest tool or source set needed for the workflow.",
      "Require approval for mutations and independently for destructive actions.",
      "Derive tenant, subject, purpose, and credential from trusted host context.",
      "Bound tool inputs, output bytes, concurrent calls, retries, and total turn time.",
      "Verify a run, event, trace, receipt, or source status independently of model prose.",
    ],
    optimize: [
      "Reduce tool definitions and provider sources to the relevant set before each turn.",
      "Use deterministic filtering and pagination before placing results in model context.",
      "Cache only versioned, non-sensitive contracts and read-only metadata.",
      "Measure tool-selection accuracy, approval rate, p50/p95 call latency, context bytes, retries, and verified completion.",
    ],
    cleanup: [
      "Revoke disposable delegated grants and remove test host configuration.",
      "Delete provider fixtures through the provider's own lifecycle when applicable.",
      "Disable mutation tools until their negative and approval tests pass again after upgrades.",
      "Retain only redacted tool, run, trace, and receipt identifiers needed for evaluation.",
    ],
    credentialAnswer: "Only a trusted server or agent host may hold delegated Praxa or provider credentials. Never place them in model input or client bundles.",
    metrics: "tool-selection accuracy, approval decisions, call latency, context size, retries, denials, and verified outcomes",
  },
  memory: {
    prerequisites: [
      "a backend-owned provider client and explicit tenant-subject namespace resolver",
      "synthetic records for at least two tenants and two subjects per tenant",
      "the exact @praxa/sdk memory package version and supported provider contract",
      "a provider cleanup procedure plus degraded-state and timeout fixtures",
    ],
    troubleshooting: [
      ["Expected record is absent", "Verify provider-native data shape, namespace mapping, filters, and source status."],
      ["Another subject sees a record", "Stop the rollout and repair server-owned tenant-subject resolution before further tests."],
      ["Provider outage looks like no memory", "Expose the source status and keep unavailable distinct from an empty successful recall."],
      ["Delete did not remove provider data", "Use the provider's lifecycle; read-only federation and hosted-candidate deletion do not erase provider sources."],
    ],
    best: [
      "Keep provider writes and lifecycle under the provider's documented API.",
      "Resolve tenant and subject in trusted backend code and test 2x2 isolation.",
      "Preserve provenance, source matches, contradictions, and per-source status.",
      "Bound concurrency, result count, context bytes, and source timeout.",
      "Never promote checkpoint, hidden, or unverified content into portable recall.",
    ],
    optimize: [
      "Query only providers and record kinds relevant to the current purpose.",
      "Use bounded parallel recall and give each source an explicit timeout budget.",
      "Deduplicate normalized content while retaining every source match and contradiction.",
      "Measure source p50/p95 latency, partial/failed recalls, result precision, context bytes, and isolation failures.",
    ],
    cleanup: [
      "Delete synthetic provider records using the provider's normal API.",
      "Hard-erase disposable hosted candidates and verify content-free receipts when used.",
      "Revoke test credentials and remove namespace fixtures for every tenant and subject.",
      "Retain only non-content source statuses, identifiers, and test results required for audit.",
    ],
    credentialAnswer: "No. Provider clients and Praxa credentials stay in the backend; adapters receive clients, not raw credentials.",
    metrics: "per-source latency/status, partial and failed recall rates, result precision, context bytes, provenance coverage, and isolation failures",
  },
  lifecycle: {
    prerequisites: [
      "disposable credentials with the exact read and write scopes used by the workflow",
      "a persisted request or event identifier before the first network attempt",
      "synthetic task, webhook, or event data plus a cleanup plan",
      "storage for durable run, cursor, delivery, or receipt readback",
    ],
    troubleshooting: [
      ["Admission is reported as completion", "Follow the run, stream, delivery, or receipt to authoritative completion evidence."],
      ["Reconnect duplicates events", "Commit the cursor only after durable processing and deduplicate by event identity."],
      ["Retry creates duplicate work", "Reuse the original idempotency key and exact request body."],
      ["Failure is ambiguous", "Record unknown state and reconcile instead of starting new work."],
    ],
    best: [
      "Persist identity before I/O and state transitions after durable processing.",
      "Treat admission, delivery attempt, and cancellation request as non-terminal acknowledgements.",
      "Verify signatures against the raw body before parsing webhook JSON.",
      "Deduplicate streams and webhooks using stable event or delivery identity.",
      "Test disconnect, duplicate, out-of-order, timeout, revocation, and cleanup paths.",
    ],
    optimize: [
      "Prefer event-driven updates while retaining bounded polling or readback reconciliation.",
      "Commit cursors in batches only when that cannot lose acknowledged application work.",
      "Keep webhook handlers short: verify, persist, acknowledge, then process asynchronously.",
      "Measure admission-to-terminal time, reconnect rate, duplicate rate, delivery latency, and reconciliation backlog.",
    ],
    cleanup: [
      "Cancel or terminally reconcile disposable runs.",
      "Disable test webhook endpoints and remove their signing secrets.",
      "Delete synthetic inbox, cursor, and delivery records after assertions.",
      "Revoke disposable credentials and keep only redacted lifecycle evidence.",
    ],
    credentialAnswer: "No. The trusted runtime owns Praxa keys, OAuth tokens, and webhook secrets; clients receive only bounded application projections.",
    metrics: "admission-to-terminal time, stream reconnects, duplicate events, webhook delivery latency, retries, and reconciliation backlog",
  },
  operations: {
    prerequisites: [
      "a written success criterion and proof boundary for the integration under test",
      "synthetic tenants, subjects, credentials, and lifecycle fixtures",
      "redacted observability fields and a secure location for test evidence",
      "an owner for rollback, cleanup, and unresolved qualification gaps",
    ],
    troubleshooting: [
      ["Dashboard says success but outcome is unknown", "Require terminal readback or an explicit incomplete verification state."],
      ["Metrics cannot be correlated", "Carry safe request, run, event, delivery, trace, and test identifiers across boundaries."],
      ["Logs contain sensitive data", "Stop collection, rotate exposed credentials, and replace raw payloads with bounded metadata."],
      ["One green test is treated as production proof", "Track package, mock, authenticated runtime, deployment, and user verification separately."],
    ],
    best: [
      "Define the expected observable result before running the test.",
      "Separate positive, denial, isolation, replay, degraded-state, and cleanup lanes.",
      "Use synthetic data and credential fingerprints rather than secrets.",
      "Record unresolved checks as pending instead of inferring success.",
      "Keep rollback and owner information beside the release evidence.",
    ],
    optimize: [
      "Run cheap contract and fake tests before authenticated canaries.",
      "Parallelize only independent test lanes and cap external side effects.",
      "Sample high-volume telemetry while retaining every denial, conflict, and terminal failure.",
      "Measure pass rate, p50/p95 latency, retry budget, isolation failures, cleanup completion, and time to diagnose.",
    ],
    cleanup: [
      "Revoke every disposable key and OAuth grant.",
      "Remove test endpoints, provider records, candidates, and local artifacts.",
      "Close or explicitly record unresolved runs and verification gaps.",
      "Publish only redacted results, exact versions, timestamps, and rollback instructions.",
    ],
    credentialAnswer: "No. Evidence contains credential fingerprints and safe identifiers, never live credentials or raw sensitive payloads.",
    metrics: "test pass rate, p50/p95 latency, authorization denials, replay conflicts, isolation failures, cleanup completion, and diagnosis time",
  },
};

const pageDetails = {
  "agent-frameworks.mdx": ["agent", "the selected framework invokes only the intended Praxa lane and produces independently verified evidence"],
  "cloudflare-workers.mdx": ["backend", "the Worker keeps the key secret, admits one task, and safely projects readback"],
  "dotnet.mdx": ["backend", "the ASP.NET boundary admits and reconciles one task through the shared HttpClient"],
  "durable-tasks.mdx": ["lifecycle", "one logical task survives exact replay and reaches an authoritative terminal state"],
  "express.mdx": ["backend", "the authenticated Express route rejects unsafe input before admitting and reading one task"],
  "fastapi.mdx": ["backend", "the FastAPI dependency boundary admits one task and maps failures without leaking upstream data"],
  "framework-backends.mdx": ["backend", "the chosen framework preserves the same server-owned credential, authority, and replay contract"],
  "framework-matrix.mdx": ["operations", "the selected framework matches the API plane, credential boundary, and required acceptance tests"],
  "go.mdx": ["backend", "the Go handler reuses its client, respects context cancellation, and reconciles one durable run"],
  "hosted-memory-candidates.mdx": ["memory", "create, lexical query, export, hard erasure, replay, and 2x2 isolation all pass"],
  "java-spring.mdx": ["backend", "the Spring boundary admits one task with typed readback and a fake-client regression test"],
  "kotlin.mdx": ["mobile", "the Kotlin client calls only its application backend and recovers one logical request across lifecycle changes"],
  "langgraph.mdx": ["memory", "the adapter reads long-term store records, excludes checkpoints, and passes 2x2 namespace isolation"],
  "mcp-tools.mdx": ["agent", "the host registers 12 exact tools and passes safe-read, wrong-scope, approval, and replay canaries"],
  "memory-federation.mdx": ["memory", "federated recall preserves source status, provenance, contradictions, bounds, and isolation"],
  "mission-lifecycle.mdx": ["lifecycle", "a mission can be created, streamed, read, signaled or cancelled, and reconciled safely"],
  "nextjs.mdx": ["backend", "the App Router keeps credentials server-only and returns a bounded task projection"],
  "nuxt.mdx": ["backend", "the Nitro route owns private runtime config and admits one replay-safe task"],
  "observability.mdx": ["operations", "run, event, usage, delivery, and trace evidence correlate without leaking tenant data"],
  "openai-agents.mdx": ["agent", "remote MCP and read-only session memory remain separate and both pass negative-boundary tests"],
  "python.mdx": ["backend", "the reusable HTTPX client admits and reconciles one task with bounded errors"],
  "react-native.mdx": ["mobile", "the app never receives a Praxa key and recovers the same request after backgrounding"],
  "resilient-events.mdx": ["lifecycle", "SSE and signed webhooks deduplicate, resume, and reconcile to one terminal state"],
  "rust.mdx": ["backend", "the reusable reqwest client preserves authority, deadlines, replay, and redacted failures"],
  "swiftui.mdx": ["mobile", "the SwiftUI app uses only its backend and recovers one request across cancellation and activation"],
  "test-your-integration.mdx": ["operations", "every required package, auth, isolation, replay, outage, lifecycle, and cleanup lane is recorded"],
  "typescript.mdx": ["backend", "the correct SDK or Fabric plane executes with server-owned credentials and exact replay behavior"],
  "vercel-ai-sdk.mdx": ["agent", "the Vercel AI SDK adapter preserves exact schemas, approvals, and authoritative result readback"],
  "webhooks.mdx": ["lifecycle", "raw-body signature, persistence, deduplication, replay, and delivery readback pass"],
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeGenerated(content, start, end) {
  const pattern = new RegExp(`\\n?${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, "g");
  return content.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n");
}

function prerequisites(profile, evidence) {
  return [
    prerequisiteStart,
    "## Prerequisites",
    "",
    "Before you begin, prepare:",
    "",
    ...profile.prerequisites.map((item) => `- ${item};`),
    `- an acceptance assertion that proves ${evidence}.`,
    prerequisiteEnd,
    "",
  ].join("\n");
}

function operations(file, profile, evidence, hasTroubleshooting, hasBest) {
  const lines = [operationsStart];
  if (!hasTroubleshooting) {
    lines.push("## Troubleshooting", "", "| Symptom | Resolution |", "|---|---|", ...profile.troubleshooting.map(([symptom, fix]) => `| ${symptom} | ${fix} |`), "");
  }
  if (!hasBest) {
    lines.push("## Best practices", "", ...profile.best.map((item) => `- ${item}`), "");
  }
  lines.push(
    "## Optimize for production",
    "",
    ...profile.optimize.map((item) => `- ${item}`),
    "",
    "Optimize only after the correctness and isolation matrix passes. Lower latency or cost is not an improvement if verified outcomes, authority checks, or recovery rates regress.",
    "",
    "## Cleanup and next steps",
    "",
    ...profile.cleanup.map((item, index) => `${index + 1}. ${item}`),
    "",
    "After cleanup, run the [shared integration test matrix](/tutorials/test-your-integration) and record any environment-specific check that remains pending.",
    "",
    "## Frequently asked questions",
    "",
    "### What proves this tutorial works?",
    "",
    `The minimum observable result is that ${evidence}. A compile, package import, mocked response, or initial admission alone does not prove the complete workflow.`,
    "",
    "### Can a browser, mobile app, or model prompt hold the credential?",
    "",
    profile.credentialAnswer,
    "",
    "### How should an ambiguous mutation be retried?",
    "",
    "Persist the exact logical input and idempotency key before the first attempt. Reconcile through authoritative readback or replay the exact request with that same key before creating new work.",
    "",
    "### What should we monitor after release?",
    "",
    `Monitor ${profile.metrics}. Alert on authorization bypass, cross-tenant disclosure, repeated conflicts, or cleanup failure.`,
    "",
    operationsEnd,
    "",
  );
  return lines.join("\n");
}

const tutorialDirectory = path.join(root, "tutorials");
const files = (await readdir(tutorialDirectory)).filter((file) => file.endsWith(".mdx") && file !== "overview.mdx").sort();
const unknown = files.filter((file) => !pageDetails[file]);
const stale = Object.keys(pageDetails).filter((file) => !files.includes(file));
if (unknown.length || stale.length) throw new Error(`Tutorial guidance inventory drift. Unknown: ${unknown.join(", ") || "none"}; stale: ${stale.join(", ") || "none"}`);

let changed = 0;
for (const file of files) {
  const absolute = path.join(tutorialDirectory, file);
  const current = await readFile(absolute, "utf8");
  let next = removeGenerated(current, prerequisiteStart, prerequisiteEnd);
  next = removeGenerated(next, operationsStart, operationsEnd).trimEnd() + "\n";
  const [profileName, evidence] = pageDetails[file];
  const profile = profiles[profileName];
  if (!/^## (?:Prerequisites|Before you begin)/im.test(next)) {
    const firstHeading = next.search(/\n## /);
    if (firstHeading === -1) throw new Error(`${file} has no H2 insertion point`);
    next = `${next.slice(0, firstHeading + 1)}${prerequisites(profile, evidence)}${next.slice(firstHeading + 1)}`;
  }
  const hasTroubleshooting = /^## Troubleshooting/im.test(next);
  const hasBest = /^## Best practices/im.test(next);
  next = `${next.trimEnd()}\n\n${operations(file, profile, evidence, hasTroubleshooting, hasBest)}`;
  if (next === current) continue;
  if (checkOnly) throw new Error(`${file} has stale tutorial guidance; run npm run docs:generate`);
  await writeFile(absolute, next, "utf8");
  changed += 1;
}

console.log(`${checkOnly ? "Checked" : "Updated"} production guidance for ${changed || "all"} tutorials.`);
