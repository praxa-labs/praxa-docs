import assert from "node:assert/strict";
import test from "node:test";
import {
  PRAXA_OPENAPI_SHA256,
  PRAXA_OPENAPI_VERSION,
  PraxaClient,
} from "@praxa/sdk";

test("quickstart creates one replay-safe typed mission request", async () => {
  const calls = [];
  const client = new PraxaClient({
    baseUrl: "https://gateway.example",
    accessToken: () => "test-token",
    maximumAttempts: 1,
    fetch: async (input, init) => {
      calls.push({ url: String(input), init });
      return Response.json(
        {
          runId: "00000000-0000-4000-8000-000000000001",
          status: "running",
          sequence: 1,
          steps: [],
        },
        { status: 202 },
      );
    },
  });

  const key = "quickstart-request-0001";
  const mission = await client.createMission(
    {
      goalSpec: { task: "Prepare the review" },
      resourceBudget: {
        maximumSteps: 4,
        maximumToolCalls: 2,
        maximumElapsedMs: 30_000,
        maximumParallelism: 1,
      },
    },
    key,
  );

  assert.equal(mission.status, "running");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://gateway.example/v8/missions");
  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get("authorization"), "Bearer test-token");
  assert.equal(headers.get("idempotency-key"), key);
  assert.equal(headers.get("x-aura-contract-version"), "aura-integration-gateway-v8.1");
});

test("quickstart pins the exact public contract", () => {
  assert.equal(PRAXA_OPENAPI_VERSION, "8.1.0");
  assert.equal(
    PRAXA_OPENAPI_SHA256,
    "a9835faa4654246f83c452ae968a569c85be28f93017882e710ca35c10dbbecc",
  );
});
