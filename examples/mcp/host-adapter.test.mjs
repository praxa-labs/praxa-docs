import assert from "node:assert/strict";
import test from "node:test";
import { PRAXA_MCP_TOOLS, praxaMcpTool } from "@praxa/mcp-contracts";

function registerPraxaTools(host, execute) {
  for (const definition of PRAXA_MCP_TOOLS) {
    host.register({
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema,
      annotations: definition.annotations,
      execute: async (input) => {
        const body = { ...input };
        const path = definition.pathArgument
          ? definition.path.replace(
              `{${definition.pathArgument}}`,
              encodeURIComponent(String(body[definition.pathArgument])),
            )
          : definition.path;
        if (definition.pathArgument) delete body[definition.pathArgument];
        try {
          return await execute({
            body,
            method: definition.method,
            path,
            requiredScope: definition.requiredScope,
          });
        } catch (error) {
          return {
            content: [{ type: "text", text: `Praxa tool failed: ${error.code || "unknown"}` }],
            isError: true,
          };
        }
      },
    });
  }
}

test("registers all exact contracts without rewriting schemas or annotations", () => {
  const registrations = [];
  registerPraxaTools({ register: (tool) => registrations.push(tool) }, async () => ({}));
  assert.equal(registrations.length, 12);
  for (const registered of registrations) {
    const published = praxaMcpTool(registered.name);
    assert.ok(published);
    assert.strictEqual(registered.inputSchema, published.inputSchema);
    assert.strictEqual(registered.annotations, published.annotations);
  }
});

test("interpolates only the declared path argument", async () => {
  const registrations = [];
  const calls = [];
  registerPraxaTools(
    { register: (tool) => registrations.push(tool) },
    async (request) => {
      calls.push(request);
      return { content: [{ type: "text", text: "ok" }] };
    },
  );
  const getMission = registrations.find((tool) => tool.name === "aura_get_mission");
  await getMission.execute({ runId: "018f0000-0000-7000-8000-000000000001" });
  assert.deepEqual(calls, [{
    body: {},
    method: "GET",
    path: "/v8/missions/018f0000-0000-7000-8000-000000000001",
    requiredScope: "missions:read",
  }]);
});

test("returns a bounded tool error instead of throwing into the host", async () => {
  const registrations = [];
  registerPraxaTools(
    { register: (tool) => registrations.push(tool) },
    async () => {
      throw Object.assign(new Error("sensitive upstream text"), { code: "authorization_failed" });
    },
  );
  const result = await registrations.find((tool) => tool.name === "aura_get_coverage").execute({});
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, "Praxa tool failed: authorization_failed");
  assert.doesNotMatch(result.content[0].text, /sensitive upstream text/);
});
