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

function renderCurl(document, method, route, operation) {
  let requestPath = route;
  const parameters = parameterList(document, operation);
  for (const parameter of parameters.filter((item) => item.in === "path")) {
    requestPath = requestPath.replace(`{${parameter.name}}`, sampleValues[parameter.name] || `${kebabCase(parameter.name)}-demo-0001`);
  }

  const query = parameters
    .filter((item) => item.in === "query" && item.required)
    .map((item) => `${encodeURIComponent(item.name)}=${encodeURIComponent(sampleValues[item.name] ?? sampleForSchema(document, item.schema, item.name))}`);
  const url = `https://api.praxa.io${requestPath}${query.length ? `?${query.join("&")}` : ""}`;
  const parts = [`curl --fail-with-body${operation.responses?.["200"]?.content?.["text/event-stream"] ? " --no-buffer" : ""} -X ${method.toUpperCase()} '${url}'`, '  -H "Authorization: Bearer $PRAXA_API_KEY"'];

  for (const parameter of parameters.filter((item) => item.in === "header")) {
    const value = parameter.name === "Idempotency-Key"
      ? `playground-${kebabCase(operation.operationId)}-0001`
      : sampleForSchema(document, parameter.schema, parameter.name);
    parts.push(`  -H "${parameter.name}: ${value}"`);
  }

  const body = requestExample(document, operation);
  if (body !== null) {
    parts.push('  -H "Content-Type: application/json"');
    parts.push(`  --data '${JSON.stringify(body, null, 2)}'`);
  }
  return parts.join(" \\\n");
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
  if (media === "text/event-stream") {
    return { status, language: "text", body: `id: 1\nevent: run.accepted\ndata: ${JSON.stringify(sample)}` };
  }
  if (media === "application/x-ndjson") {
    return { status, language: "jsonl", body: JSON.stringify({ type: "candidate", data: sample }) };
  }
  return { status, language: "json", body: JSON.stringify(sample, null, 2) };
}

function renderPage(document, source, method, route, operation) {
  const scopes = scopeList(operation);
  const activation = operation["x-activation-status"]
    ? operation["x-activation-status"].replaceAll("-", " ").replace(/^./, (value) => value.toUpperCase())
    : source.defaultStatus;
  const responseExample = renderResponseExample(document, operation);
  const parameterFields = renderParamFields(document, operation);
  const lines = [
    "---",
    `title: "${escapeFrontmatter(operation.summary)}"`,
    `sidebarTitle: "${escapeFrontmatter(operation.summary)}"`,
    `description: "${escapeFrontmatter(operation.description || operation.summary)}"`,
    `api: "${method.toUpperCase()} ${route}"`,
    'authMethod: "bearer"',
    'playground: "interactive"',
    "---",
    "",
    "{/* Generated from the checked OpenAPI source. Run npm run docs:generate after changing the contract. */}",
    "",
    operation.description || operation.summary,
    "",
    "<Info>",
    `  **Availability:** ${activation}. **Required scope${scopes.length === 1 ? "" : "s"}:** ${scopes.length ? scopes.map((scope) => `\`${scope}\``).join(", ") : "authenticated key"}.`,
    "</Info>",
    "",
    "Use a disposable personal workspace key and verify the returned resource or receipt before treating the operation as complete.",
    "",
    "## Request fields",
    "",
    ...(parameterFields.length
      ? parameterFields
      : ["This operation has no path, query, header, or JSON-body fields beyond bearer authentication.", ""]),
    ...renderResponseFields(document, operation),
    "<RequestExample>",
    "~~~bash cURL",
    renderCurl(document, method, route, operation),
    "~~~",
    "</RequestExample>",
    "",
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
    "## Verify and recover",
    "",
    "- Treat `401`, `403`, and `409` as authority or state signals, not generic retry prompts.",
    ...(hasIdempotency ? ["- Reuse the idempotency key only for an exact retry of the same logical mutation."] : []),
    "- For `429` or retryable 5xx responses, follow server retry guidance and keep a bounded attempt budget.",
    "- Revoke the disposable key and remove test data after validation.",
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
    if (current !== normalized) throw new Error(`${relativePath} is stale; run npm run docs:generate`);
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
