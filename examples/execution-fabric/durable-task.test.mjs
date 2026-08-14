import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskRequest,
  idempotencyKeyFor,
  submitTask,
  waitForTerminal,
} from "./durable-task.mjs";

test("builds the exact replay-safe task envelope", () => {
  const first = buildTaskRequest({
    apiKey: "secret",
    input: "Prepare the review",
    requestId: "logical-request-1",
  });
  const second = buildTaskRequest({
    apiKey: "secret",
    input: "Prepare the review",
    requestId: "logical-request-1",
  });

  assert.equal(first.url, "https://api.praxa.io/v1/execute");
  assert.equal(first.init.headers["idempotency-key"], second.init.headers["idempotency-key"]);
  assert.equal(
    first.init.headers["idempotency-key"],
    idempotencyKeyFor("logical-request-1"),
  );
  const body = JSON.parse(first.init.body);
  assert.equal(body.apiVersion, "v1");
  assert.equal(body.mode, "task");
  assert.equal(body.idempotencyKey, first.init.headers["idempotency-key"]);
});

test("submits once and returns the admitted run", async () => {
  const calls = [];
  const run = await submitTask(
    { apiKey: "secret", input: "Prepare the review", requestId: "request-1" },
    async (url, init) => {
      calls.push({ url, init });
      return Response.json({ run_id: "run-1", status: "queued" }, { status: 202 });
    },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(run, { run_id: "run-1", status: "queued" });
});

test("polls until terminal with no-store reads", async () => {
  const statuses = ["running", "completed"];
  const reads = [];
  const terminal = await waitForTerminal(
    { run_id: "run-1", status: "queued" },
    "secret",
    async (url, init) => {
      reads.push({ url, init });
      return Response.json({ run_id: "run-1", status: statuses.shift() });
    },
    async () => {},
  );

  assert.equal(terminal.status, "completed");
  assert.equal(reads.length, 2);
  assert.ok(reads.every((read) => read.init.cache === "no-store"));
});
