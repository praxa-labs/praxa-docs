import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse } from "yaml";

const methods = new Set(["get", "post", "patch", "delete", "put"]);

async function operations(file) {
  const document = parse(await readFile(new URL(`../../${file}`, import.meta.url), "utf8"));
  return Object.entries(document.paths).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(([method]) => methods.has(method))
      .map(([method, operation]) => ({ method, operation, path })),
  );
}

test("the playground covers every active operation and excludes pending approval", async () => {
  const all = [
    ...(await operations("fabric/api/openapi.yaml")),
    ...(await operations("memory-federation/openapi.yaml")),
  ];
  const active = all.filter(({ operation }) =>
    !operation["x-hidden"] && operation["x-activation-status"] !== "pending"
  );
  assert.equal(active.length, 15);
  assert.deepEqual(
    all.filter(({ operation }) => operation["x-hidden"]).map(({ method, path }) => `${method.toUpperCase()} ${path}`),
    ["POST /v1/runs/{id}/approve"],
  );
});

test("both public specifications document representative fail-closed problems", async () => {
  for (const file of ["fabric/api/openapi.yaml", "memory-federation/openapi.yaml"]) {
    const document = parse(await readFile(new URL(`../../${file}`, import.meta.url), "utf8"));
    const examples = document.components.responses.ProblemResponse.content["application/problem+json"].examples;
    assert.deepEqual(Object.keys(examples), [
      "authentication_failed",
      "authorization_failed",
      "invalid_request",
      "conflict",
      "rate_limited",
    ]);
    assert.equal(examples.authentication_failed.value.status, 401);
    assert.equal(examples.authorization_failed.value.status, 403);
    assert.equal(examples.conflict.value.status, 409);
    assert.equal(examples.rate_limited.value.status, 429);
  }
});

test("generated event examples stream incrementally and keep cursor identity", async () => {
  const page = await readFile(
    new URL("../../api-playground/execution-fabric/stream-run-events.mdx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Accept": "text\/event-stream"/);
  assert.match(page, /for await \(const chunk of response\.body\)/);
  assert.match(page, /for raw_line in response:/);
  assert.match(page, /id: 1\nevent: run\.accepted\ndata: .*"sequence":1/);
  assert.doesNotMatch(page, /Use a streaming SSE parser in production/);
});

test("generated memory success mirrors the submitted portable envelope", async () => {
  const page = await readFile(
    new URL("../../api-playground/memory/create-memory-candidate.mdx", import.meta.url),
    "utf8",
  );
  const response = page.slice(page.indexOf("<ResponseExample>"), page.indexOf("</ResponseExample>"));
  assert.match(response, /"replayed": false/);
  assert.match(response, /"providerId": "custom"/);
  assert.match(response, /"sourceId": "customer-profile"/);
  assert.match(response, /"content": "Prefers concise weekly summaries\."/);
  assert.match(response, /"confidence": 1/);
});

test("every generated cURL, Node.js, and Python request parses", async () => {
  for (const directory of ["execution-fabric", "memory"]) {
    const root = new URL(`../../api-playground/${directory}/`, import.meta.url);
    for (const file of await readdir(root)) {
      if (!file.endsWith(".mdx")) continue;
      const page = await readFile(new URL(file, root), "utf8");
      const bash = page.match(/~~~bash cURL\n([\s\S]*?)\n~~~/)?.[1];
      const javascript = page.match(/~~~javascript Node\.js\n([\s\S]*?)\n~~~/)?.[1];
      const python = page.match(/~~~python Python\n([\s\S]*?)\n~~~/)?.[1];
      assert.ok(bash && javascript && python, `${directory}/${file} must expose all three request examples`);

      const bashResult = spawnSync("bash", ["-n"], { input: bash, encoding: "utf8" });
      assert.equal(bashResult.status, 0, `${directory}/${file} cURL syntax: ${bashResult.stderr}`);
      assert.doesNotThrow(
        () => new Function(`return async function generatedExample() {\n${javascript}\n}`),
        `${directory}/${file} Node.js syntax`,
      );
      const pythonResult = spawnSync(
        "python3",
        ["-c", "import sys; compile(sys.stdin.read(), '<generated-example>', 'exec')"],
        { input: python, encoding: "utf8" },
      );
      assert.equal(pythonResult.status, 0, `${directory}/${file} Python syntax: ${pythonResult.stderr}`);
    }
  }
});
