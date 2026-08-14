import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const sources = [
  {
    file: "fabric/api/openapi.yaml",
    directory: "api-playground/execution-fabric",
    defaultStatus: "Production partner preview",
  },
  {
    file: "memory-federation/openapi.yaml",
    directory: "api-playground/memory",
    defaultStatus: "Deployed qualification preview",
  },
];

const sampleValues = {
  api_key_id: "key-demo-0001",
  cursor: "cursor-demo-0001",
  deliveryId: "delivery-demo-0001",
  endpoint_id: "endpoint-demo-0001",
  endpointId: "endpoint-demo-0001",
  from: "2026-08-01T00:00:00.000Z",
  id: "018f0000-0000-7000-8000-000000000001",
  recordId: "018f0000-0000-7000-8000-000000000002",
  subject: "customer-42",
  to: "2026-09-01T00:00:00.000Z",
};

const operationGuidance = {
  executeDurableTask: {
    description: "Admit a durable Praxa task with a personal workspace API key, then verify the returned run through readback or reconnectable events.",
    success: "A `202` response proves durable admission or an exact idempotent replay. It does not prove that the task completed.",
    verify: ["Save `run_id` and `Location`.", "Read the run or consume events until a terminal state.", "Replay the exact request with the same key and require the same logical run."],
  },
  getRun: {
    description: "Read the customer-safe projection for one tenant-owned Praxa run and distinguish running, completed, failed, and cancelled states.",
    success: "A `200` response is the current durable projection for that run; use its status rather than model prose as authority.",
    verify: ["Match the returned run ID to the submitted run.", "Require a known status value.", "Test the same ID with an under-scoped and foreign-tenant key."],
  },
  streamRunEvents: {
    description: "Stream ordered Praxa run events over SSE, persist the numeric cursor, and resume safely after a disconnect.",
    success: "A `200` response opens an SSE stream. Completion is proven only by a terminal event or authoritative run readback.",
    verify: ["Require each event `id` to match its payload sequence.", "Reconnect with `Last-Event-ID` and reject sequence regression.", "Treat EOF before a terminal event as incomplete."],
  },
  cancelRun: {
    description: "Request cancellation of a durable Praxa run and reconcile the run until it reaches an authoritative terminal outcome.",
    success: "A `200` response acknowledges the cancellation request and returns a run projection; it does not imply rollback or immediate cancellation.",
    verify: ["Confirm the returned run ID matches the target.", "Continue run or event readback until terminal.", "Do not report cancellation while the projection remains running."],
  },
  getUsage: {
    description: "Read tenant-scoped Praxa usage totals and UTC time buckets for a bounded reporting range and optional API key filter.",
    success: "A `200` response contains evidence-bounded usage for the authenticated tenant and requested range.",
    verify: ["Confirm the response echoes the requested range and grouping.", "Check that every bucket is inside the range.", "Repeat with an owned API key filter and reject foreign key IDs."],
  },
  listWebhookEndpoints: {
    description: "List tenant-owned Praxa webhook endpoint metadata without exposing any endpoint signing secret.",
    success: "A `200` response returns only endpoint metadata for the authenticated tenant; signing secrets must be absent.",
    verify: ["Confirm every endpoint belongs to the intended environment.", "Require signing secrets to be absent.", "Test with an under-scoped key."],
  },
  createWebhookEndpoint: {
    description: "Create a Praxa webhook endpoint, capture its one-time signing secret, and verify signed delivery with least-privilege scopes.",
    success: "A `201` response creates the endpoint and returns its signing secret exactly once.",
    verify: ["Store the secret in a secret manager immediately.", "Trigger one disposable matching event and verify its raw-body signature.", "List the endpoint and confirm the secret is no longer returned."],
  },
  updateWebhookEndpoint: {
    description: "Update an existing Praxa webhook URL, event filter, or enabled state with a strict non-empty request.",
    success: "A `200` response is the updated endpoint metadata; no signing secret is returned.",
    verify: ["Read the endpoint list and confirm the changed fields.", "Trigger only an event allowed by the new filter.", "Confirm a foreign endpoint ID fails closed."],
  },
  deleteWebhookEndpoint: {
    description: "Disable a tenant-owned Praxa webhook endpoint and verify that no later event delivery is attempted.",
    success: "A `204` response means the endpoint was disabled and intentionally has no response body.",
    verify: ["List endpoints and confirm the target is no longer enabled.", "Trigger a disposable event and confirm no new delivery targets it.", "Remove the stored signing secret."],
  },
  listWebhookDeliveries: {
    description: "Inspect cursor-paged Praxa webhook delivery records by endpoint, run, or delivery status without exposing signed payload secrets.",
    success: "A `200` response returns one tenant-scoped delivery page and an opaque continuation cursor when more data exists.",
    verify: ["Match delivery endpoint and run IDs to your records.", "Follow the opaque cursor without modifying it.", "Reject a foreign endpoint or run filter."],
  },
  replayWebhookDelivery: {
    description: "Request an idempotent replay of a Praxa webhook delivery after correcting the destination failure.",
    success: "A `202` response returns the created or idempotently reused replay delivery; it does not prove destination acceptance.",
    verify: ["Fix and health-check the destination before replaying.", "Follow delivery readback to its final status.", "Repeat the same replay request and require one logical replay."],
  },
  createMemoryCandidate: {
    description: "Create or exactly replay one isolated, subject-scoped Praxa memory candidate with portable provenance and no first-party memory promotion.",
    success: "A `201` response created a candidate; `200` means the same idempotent request was replayed. Neither promotes content into Praxa personal memory.",
    verify: ["Save the candidate ID and require `replayed: false` on first create.", "Query the exact subject and require lexical retrieval only.", "Replay the exact body/key and require the same candidate with `replayed: true`."],
  },
  queryMemoryCandidates: {
    description: "Run bounded lexical search over one subject's isolated Praxa memory candidates with provider and record-kind filters.",
    success: "A `200` response contains subject-scoped lexical matches. It is not vector, semantic, or graph recall.",
    verify: ["Require `retrievalMode: \"lexical\"`.", "Confirm every result matches the requested subject and filters.", "Query a second subject and tenant and require isolation."],
  },
  exportMemoryCandidates: {
    description: "Export one subject's Praxa memory candidates and content-free deletion history as cursor-paged NDJSON.",
    success: "A `200` response streams one JSON object per line; `X-Praxa-Next-Cursor` indicates another page.",
    verify: ["Parse every non-empty line independently.", "Use the cursor exactly as returned.", "Require deletion entries to contain no erased content."],
  },
  deleteMemoryCandidate: {
    description: "Hard-erase one Praxa memory candidate and receive a content-free, replay-safe deletion receipt without deleting its provider source.",
    success: "A `200` response confirms candidate erasure or exact deletion replay. Provider-owned source data is unchanged.",
    verify: ["Require `erased: true` and a content-free receipt.", "Query the subject and confirm candidate content is absent.", "Replay with the same key and require the same receipt."],
  },
};

function kebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function oneLine(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeFrontmatter(value) {
  return oneLine(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeMdx(value) {
  return oneLine(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function resolveRef(document, value) {
  if (!value?.$ref) return value;
  const segments = value.$ref.replace(/^#\//, "").split("/");
  return segments.reduce((current, segment) => current?.[segment], document);
}

function mergeSchema(document, schema) {
  const resolved = resolveRef(document, schema) || {};
  if (!resolved.allOf) return resolved;
  return resolved.allOf.reduce(
    (combined, part) => {
      const next = mergeSchema(document, part);
      return {
        ...combined,
        ...next,
        properties: { ...(combined.properties || {}), ...(next.properties || {}) },
        required: [...new Set([...(combined.required || []), ...(next.required || [])])],
      };
    },
    {},
  );
}

function schemaType(document, schema) {
  const resolved = mergeSchema(document, schema);
  if (resolved.oneOf) return resolved.oneOf.map((item) => schemaType(document, item)).join(" | ");
  if (resolved.const !== undefined) return String(resolved.const);
  if (resolved.enum) return resolved.enum.map(String).join(" | ");
  if (Array.isArray(resolved.type)) return resolved.type.join(" | ");
  if (resolved.type === "array") return `array<${schemaType(document, resolved.items)}>`;
  return resolved.type || resolved.format || "object";
}

function sampleForSchema(document, schema, key = "value", depth = 0) {
  const resolved = mergeSchema(document, schema);
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.const !== undefined) return resolved.const;
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.oneOf?.length) return sampleForSchema(document, resolved.oneOf[0], key, depth + 1);
  if (depth > 4) return "example";

  const type = Array.isArray(resolved.type)
    ? resolved.type.find((item) => item !== "null")
    : resolved.type;
  if (type === "object" || resolved.properties) {
    const result = {};
    let names = resolved.required || [];
    if (names.length === 0 && resolved.minProperties > 0) {
      names = Object.keys(resolved.properties || {}).slice(0, 1);
    }
    for (const name of names) {
      result[name] = sampleForSchema(document, resolved.properties?.[name], name, depth + 1);
    }
    return result;
  }
  if (type === "array") {
    return [sampleForSchema(document, resolved.items, key, depth + 1)];
  }
  if (type === "integer" || type === "number") return resolved.minimum ?? 1;
  if (type === "boolean") return true;
  if (type === "null") return null;
  if (resolved.format === "uuid") return "018f0000-0000-7000-8000-000000000001";
  if (resolved.format === "date-time") return "2026-08-13T12:00:00.000Z";
  if (resolved.format === "uri" || resolved.format === "url") return "https://example.com/praxa";
  if (resolved.pattern === "^/v1/runs/") {
    const base = "/v1/runs/018f0000-0000-7000-8000-000000000001";
    return key === "events" ? `${base}/events` : base;
  }
  if (key === "input") return "Prepare a concise weekly review.";
  if (key.toLowerCase().includes("url")) return "https://events.example.com/webhooks/praxa";
  if (key.toLowerCase().includes("secret")) return "example-secret-not-for-production";
  if (key.toLowerCase().includes("digest")) return "a".repeat(64);
  return sampleValues[key] || `${kebabCase(key)}-demo-0001`;
}

function parameterList(document, operation) {
  return (operation.parameters || []).map((parameter) => resolveRef(document, parameter));
}

function scopeList(operation) {
  return [
    ...(operation["x-required-scopes"] || []),
    ...(operation["x-gateway-required-scopes"] || []),
    ...(operation["x-backend-required-scopes"] || []),
  ].filter((scope, index, values) => values.indexOf(scope) === index);
}

function requestSchema(document, operation) {
  return operation.requestBody?.content?.["application/json"]?.schema
    ? mergeSchema(document, operation.requestBody.content["application/json"].schema)
    : null;
}

function requestExample(document, operation) {
  const content = operation.requestBody?.content?.["application/json"];
  if (!content) return null;
  return content.example ?? sampleForSchema(document, content.schema);
}

function successResponse(operation) {
  const responses = operation.responses || {};
  for (const code of ["201", "202", "200", "204", "206"]) {
    if (responses[code]) return [code, responses[code]];
  }
  return Object.entries(responses).find(([code]) => /^2\d\d$/.test(code));
}

function isEventStream(operation) {
  return Boolean(operation.responses?.["200"]?.content?.["text/event-stream"]);
}

function responseSchema(document, operation) {
  const success = successResponse(operation);
  if (!success) return null;
  const content = success[1]?.content || {};
  const media = Object.keys(content)[0];
  return media ? mergeSchema(document, content[media]?.schema) : null;
}

function renderParamFields(document, operation) {
  const lines = [];
  for (const parameter of parameterList(document, operation)) {
    const location = parameter.in === "header" ? "header" : parameter.in;
    lines.push(
      `<ParamField ${location}="${parameter.name}" type="${escapeFrontmatter(schemaType(document, parameter.schema))}"${parameter.required ? " required" : ""}>`,
      `  ${escapeMdx(parameter.description || `${parameter.name} ${parameter.in} parameter.`)}`,
      "</ParamField>",
      "",
    );
  }

  const bodySchema = requestSchema(document, operation);
  if (bodySchema?.properties) {
    const fields = [];
    const collectFields = (properties, required = [], prefix = "", depth = 0) => {
      for (const [name, property] of Object.entries(properties || {})) {
        const resolved = mergeSchema(document, property);
        const fieldName = prefix ? `${prefix}.${name}` : name;
        if (depth < 2 && resolved.properties && resolved.additionalProperties !== true) {
          collectFields(resolved.properties, resolved.required || [], fieldName, depth + 1);
        } else {
          fields.push({ name: fieldName, property, resolved, required: required.includes(name) });
        }
      }
    };
    collectFields(bodySchema.properties, bodySchema.required || []);
    for (const { name, property, resolved, required } of fields) {
      lines.push(
        `<ParamField body="${name}" type="${escapeFrontmatter(schemaType(document, property))}"${required ? " required" : ""}>`,
        `  ${escapeMdx(resolved.description || `${name} request field.`)}`,
        "</ParamField>",
        "",
      );
    }
  }
  return lines;
}

function renderResponseFields(document, operation) {
  const success = successResponse(operation);
  if (!success) return [];
  const [status, response] = success;
  const schema = responseSchema(document, operation);
  const lines = ["## Successful response", "", `**${status}** — ${escapeMdx(response.description || "Request accepted.")}`, ""];
  if (!schema?.properties) return lines;
  for (const [name, property] of Object.entries(schema.properties)) {
    const resolved = mergeSchema(document, property);
    lines.push(
      `<ResponseField name="${name}" type="${escapeFrontmatter(schemaType(document, property))}"${schema.required?.includes(name) ? " required" : ""}>`,
      `  ${escapeMdx(resolved.description || `${name} response field.`)}`,
      "</ResponseField>",
      "",
    );
  }
  return lines;
}

function requestDetails(document, route, operation) {
  let requestPath = route;
  const parameters = parameterList(document, operation);
  const body = requestExample(document, operation);
  for (const parameter of parameters.filter((item) => item.in === "path")) {
    requestPath = requestPath.replace(`{${parameter.name}}`, sampleValues[parameter.name] || `${kebabCase(parameter.name)}-demo-0001`);
  }

  const query = parameters
    .filter((item) => item.in === "query" && item.required)
    .map((item) => `${encodeURIComponent(item.name)}=${encodeURIComponent(sampleValues[item.name] ?? sampleForSchema(document, item.schema, item.name))}`);
  const url = `https://api.praxa.io${requestPath}${query.length ? `?${query.join("&")}` : ""}`;
  const headers = { Authorization: "Bearer $PRAXA_API_KEY" };

  for (const parameter of parameters.filter((item) => item.in === "header")) {
    const value = parameter.name === "Idempotency-Key"
      ? body?.idempotencyKey || `playground-${kebabCase(operation.operationId)}-0001`
      : sampleForSchema(document, parameter.schema, parameter.name);
    headers[parameter.name] = String(value);
  }

  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (isEventStream(operation)) {
    headers.Accept = "text/event-stream";
  }
  return { body, headers, url };
}

function renderCurl(document, method, route, operation) {
  const { body, headers, url } = requestDetails(document, route, operation);
  const parts = [`curl --fail-with-body${isEventStream(operation) ? " --no-buffer" : ""} -X ${method.toUpperCase()} '${url}'`];
  for (const [name, value] of Object.entries(headers)) parts.push(`  -H "${name}: ${value}"`);
  if (body !== null) parts.push(`  --data '${JSON.stringify(body, null, 2)}'`);
  return parts.join(" \\\n");
}

function renderJavaScript(document, method, route, operation) {
  const { body, headers, url } = requestDetails(document, route, operation);
  const jsHeaders = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name, value.replace("$PRAXA_API_KEY", "${process.env.PRAXA_API_KEY}")]),
  );
  const options = {
    method: method.toUpperCase(),
    headers: jsHeaders,
    ...(body === null ? {} : { body: "__BODY__" }),
  };
  const serialized = JSON.stringify(options, null, 2)
    .replace('"Bearer ${process.env.PRAXA_API_KEY}"', '`Bearer ${process.env.PRAXA_API_KEY}`')
    .replace('"__BODY__"', `JSON.stringify(${JSON.stringify(body, null, 2).replace(/^/gm, "  ").trimStart()})`);
  const requestLines = [
    `const response = await fetch(${JSON.stringify(url)}, ${serialized});`,
  ];
  if (isEventStream(operation)) {
    return [
      ...requestLines,
      "if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);",
      'if (!response.body) throw new Error("SSE response had no body");',
      "const decoder = new TextDecoder();",
      'let buffer = "";',
      "for await (const chunk of response.body) {",
      '  buffer = (buffer + decoder.decode(chunk, { stream: true })).replaceAll("\\r\\n", "\\n");',
      "  for (;;) {",
      '    const boundary = buffer.indexOf("\\n\\n");',
      "    if (boundary < 0) break;",
      "    const frame = buffer.slice(0, boundary);",
      "    buffer = buffer.slice(boundary + 2);",
      '    if (frame && !frame.startsWith(":")) console.log(frame);',
      "  }",
      "}",
    ].join("\n");
  }
  return [
    ...requestLines,
    "const text = await response.text();",
    "if (!response.ok) throw new Error(`${response.status}: ${text}`);",
    "console.log(text ? JSON.parse(text) : { status: response.status });",
  ].join("\n");
}

function renderPython(document, method, route, operation) {
  const { body, headers, url } = requestDetails(document, route, operation);
  const pythonHeaders = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name, value.replace("$PRAXA_API_KEY", "__TOKEN__")]),
  );
  const headerLiteral = JSON.stringify(pythonHeaders, null, 2)
    .replace('"Bearer __TOKEN__"', 'f"Bearer {os.environ[\'PRAXA_API_KEY\']}"')
    .replaceAll("true", "True")
    .replaceAll("false", "False")
    .replaceAll("null", "None");
  const lines = ["import json", "import os", "from urllib import error, request", ""];
  if (body !== null) lines.push(`payload = json.dumps(${JSON.stringify(body, null, 2).replaceAll("true", "True").replaceAll("false", "False").replaceAll("null", "None")}).encode()`, "");
  lines.push(
    "req = request.Request(",
    `    ${JSON.stringify(url)},`,
    `    method=${JSON.stringify(method.toUpperCase())},`,
    `    headers=${headerLiteral.replace(/^/gm, "    ").trimStart()},`,
    ...(body === null ? [] : ["    data=payload,"]),
    ")",
  );
  if (isEventStream(operation)) {
    lines.push(
      "try:",
      "    with request.urlopen(req, timeout=30) as response:",
      "        frame_lines = []",
      "        for raw_line in response:",
      '            line = raw_line.decode("utf-8").rstrip("\\r\\n")',
      "            if line:",
      '                if not line.startswith(":"):',
      "                    frame_lines.append(line)",
      "            elif frame_lines:",
      '                print("\\n".join(frame_lines), flush=True)',
      "                frame_lines.clear()",
      "        if frame_lines:",
      '            print("\\n".join(frame_lines), flush=True)',
      "except error.HTTPError as exc:",
      "    raise RuntimeError(f\"{exc.code}: {exc.read().decode()}\") from exc",
    );
  } else {
    lines.push(
      "try:",
      "    with request.urlopen(req, timeout=30) as response:",
      "        text = response.read().decode()",
      "        print(json.loads(text) if text else {\"status\": response.status})",
      "except error.HTTPError as exc:",
      "    raise RuntimeError(f\"{exc.code}: {exc.read().decode()}\") from exc",
    );
  }
  return lines.join("\n");
}

function renderResponseExample(document, operation) {
  const success = successResponse(operation);
  if (!success) return null;
  const [status, response] = success;
  const content = response.content || {};
  const media = Object.keys(content)[0];
  if (!media) return null;
  const schema = content[media]?.schema;
  if (!schema) return null;
  const sample = sampleForSchema(document, schema);
  if (sample && typeof sample === "object" && "replayed" in sample) sample.replayed = false;
  if (operation.operationId === "createMemoryCandidate" && sample?.candidate) {
    sample.candidate.record = requestExample(document, operation);
  }
  if (media === "text/event-stream") {
    if (sample && typeof sample === "object" && "sequence" in sample) sample.sequence = 1;
    return { status, language: "text", body: `id: 1\nevent: run.accepted\ndata: ${JSON.stringify(sample)}` };
  }
  if (media === "application/x-ndjson") {
    return {
      status,
      language: "jsonl",
      body: JSON.stringify({ type: "candidate", record: { id: sampleValues.recordId, subject: sampleValues.subject } }) +
        "\n" +
        JSON.stringify({ type: "deletion", receipt: { recordId: sampleValues.recordId, erasedAt: "2026-08-13T12:05:00.000Z" } }),
    };
  }
  return { status, language: "json", body: JSON.stringify(sample, null, 2) };
}

function renderPage(document, source, method, route, operation) {
  const scopes = scopeList(operation);
  const guidance = operationGuidance[operation.operationId];
  if (!guidance) throw new Error(`Missing API Playground guidance for ${operation.operationId}`);
  const activation = operation["x-activation-status"]
    ? operation["x-activation-status"].replaceAll("-", " ").replace(/^./, (value) => value.toUpperCase())
    : source.defaultStatus;
  const responseExample = renderResponseExample(document, operation);
  const parameterFields = renderParamFields(document, operation);
  const lines = [
    "---",
    `title: "${escapeFrontmatter(operation.summary)}"`,
    `sidebarTitle: "${escapeFrontmatter(operation.summary)}"`,
    `description: "${escapeFrontmatter(guidance.description)}"`,
    `api: "${method.toUpperCase()} ${route}"`,
    'authMethod: "bearer"',
    'playground: "interactive"',
    "---",
    "",
    "{/* Generated from the checked OpenAPI source. Run npm run docs:generate after changing the contract. */}",
    "",
    guidance.description,
    "",
    "<Info>",
    `  **Availability:** ${activation}. **Required scope${scopes.length === 1 ? "" : "s"}:** ${scopes.length ? scopes.map((scope) => `\`${scope}\``).join(", ") : "authenticated key"}.`,
    "</Info>",
    "",
    "## Authenticate safely",
    "",
    `Create a disposable **personal workspace** API key with exactly ${scopes.length ? scopes.map((scope) => `\`${scope}\``).join(" and ") : "the required scope"}. Send it as \`Authorization: Bearer $PRAXA_API_KEY\`. A Gateway OAuth token, Supabase JWT, provider credential, or organization memory key is not interchangeable with this key.`,
    "",
    "The hosted playground sends the credential from your browser session to the documented API through the configured playground proxy. Use test data, never share the key, and revoke it when the check ends.",
    "",
    "## Request fields",
    "",
    ...(parameterFields.length
      ? parameterFields
      : ["This operation has no path, query, header, or JSON-body fields beyond bearer authentication.", ""]),
    "## Runnable request examples",
    "",
    "<CodeGroup>",
    "~~~bash cURL",
    renderCurl(document, method, route, operation),
    "~~~",
    "~~~javascript Node.js",
    renderJavaScript(document, method, route, operation),
    "~~~",
    "~~~python Python",
    renderPython(document, method, route, operation),
    "~~~",
    "</CodeGroup>",
    "",
    "## What success means",
    "",
    guidance.success,
    "",
    ...renderResponseFields(document, operation),
  ];

  if (responseExample) {
    lines.push(
      "<ResponseExample>",
      `~~~${responseExample.language} ${responseExample.status}`,
      responseExample.body,
      "~~~",
      "</ResponseExample>",
      "",
    );
  }

  const parameters = parameterList(document, operation);
  const bodySchema = requestSchema(document, operation);
  const hasIdempotency = parameters.some((parameter) => parameter.name === "Idempotency-Key") || Boolean(bodySchema?.properties?.idempotencyKey);
  lines.push(
    "## Handle failures",
    "",
    "| Response | Meaning | Safe action |",
    "|---|---|---|",
    "| `400 invalid_request` | The method, path, headers, query, or body failed strict validation. | Correct the request; do not retry unchanged input. |",
    "| `401 authentication_failed` | The bearer key is missing, malformed, expired, or revoked. | Stop and replace the key through the authenticated console. |",
    "| `403 authorization_failed` | The authenticated key lacks scope or tenant authority. | Request only the missing least-privilege scope; never substitute another tenant ID. |",
    ...(hasIdempotency ? ["| `409 conflict` | The same idempotency key was paired with different logical input or state. | Restore the original body or create a key for a genuinely new operation. |"] : []),
    "| `429 rate_limited` | The principal exceeded a bounded rate. | Honor `retryAfterMs` or `Retry-After`, add jitter, and cap attempts. |",
    "| retryable `5xx` | The server could not confirm a final response. | Reconcile reads or replay the exact keyed mutation before creating new work. |",
    "",
    "~~~json Example problem",
    JSON.stringify({
      type: "https://docs.praxa.io/problems/authorization-failed",
      title: "Authorization failed",
      status: 403,
      code: "authorization_failed",
      detail: "The API key does not grant the required scope.",
      retryable: false,
    }, null, 2),
    "~~~",
    "",
    "## Verify the result",
    "",
    ...guidance.verify.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Retry, cleanup, and production use",
    "",
    "- Treat `401`, `403`, and `409` as authority or state signals, not generic retry prompts.",
    ...(hasIdempotency ? ["- Reuse the idempotency key only for an exact retry of the same logical mutation."] : []),
    "- For `429` or retryable 5xx responses, follow server retry guidance and keep a bounded attempt budget.",
    "- Move the request into a trusted application backend before production; never ship the Praxa key in browser or mobile code.",
    "- Revoke the disposable key, disable test webhooks, and erase disposable candidate data after validation.",
    "",
    "Continue with [API authentication](/api-playground/authentication), the [failure and retry guide](/api-playground/errors), and the [end-to-end coverage matrix](/api-playground/coverage-and-testing).",
    "",
  );
  return lines.join("\n");
}

async function writeOrCheck(relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  if (checkOnly) {
    let current = "";
    try {
      current = await readFile(absolutePath, "utf8");
    } catch {
      throw new Error(`${relativePath} is missing; run npm run docs:generate`);
    }
    const withoutSearchMetadata = (value) => value.replace(/^keywords: .*\n/m, "");
    if (withoutSearchMetadata(current) !== withoutSearchMetadata(normalized)) throw new Error(`${relativePath} is stale; run npm run docs:generate`);
    return;
  }
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, normalized, "utf8");
}

let generated = 0;
for (const source of sources) {
  const document = parse(await readFile(path.join(root, source.file), "utf8"));
  for (const [route, pathItem] of Object.entries(document.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "patch", "delete", "put"].includes(method)) continue;
      if (operation["x-hidden"] || operation["x-activation-status"] === "pending") continue;
      const relativePath = `${source.directory}/${kebabCase(operation.operationId)}.mdx`;
      await writeOrCheck(relativePath, renderPage(document, source, method, route, operation));
      generated += 1;
    }
  }
}

console.log(`${checkOnly ? "Checked" : "Generated"} ${generated} interactive API Playground pages.`);
