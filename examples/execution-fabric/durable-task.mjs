import { createHash, randomUUID } from "node:crypto";

const API_ORIGIN = "https://api.praxa.io";
const terminalStates = new Set(["completed", "failed", "cancelled"]);

export function idempotencyKeyFor(requestId) {
  if (typeof requestId !== "string" || requestId.length === 0) {
    throw new TypeError("requestId is required");
  }
  return "example:" + createHash("sha256").update(requestId).digest("hex");
}

export function buildTaskRequest({ apiKey, input, requestId }) {
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new TypeError("apiKey is required");
  }
  if (typeof input !== "string" || input.length < 1 || input.length > 16_000) {
    throw new TypeError("input must contain 1 to 16000 characters");
  }

  const idempotencyKey = idempotencyKeyFor(requestId);
  return {
    url: API_ORIGIN + "/v1/execute",
    init: {
      method: "POST",
      headers: {
        authorization: "Bearer " + apiKey,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        apiVersion: "v1",
        requestId: idempotencyKey,
        mode: "task",
        task: { input },
        idempotencyKey,
      }),
    },
  };
}

export async function submitTask(options, fetchImpl = fetch) {
  const request = buildTaskRequest(options);
  const response = await fetchImpl(request.url, request.init);
  if (!response.ok) throw new Error("Task admission failed: " + (await response.text()));
  return response.json();
}

export async function waitForTerminal(run, apiKey, fetchImpl = fetch, sleep = defaultSleep) {
  let current = run;
  while (!terminalStates.has(current.status)) {
    await sleep(1_000);
    const response = await fetchImpl(API_ORIGIN + "/v1/runs/" + encodeURIComponent(current.run_id), {
      headers: { authorization: "Bearer " + apiKey },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Run read failed: " + (await response.text()));
    current = await response.json();
  }
  return current;
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const input = process.argv.slice(2).join(" ").trim();
  const apiKey = process.env.PRAXA_API_KEY;
  if (!input || !apiKey) {
    console.error("Usage: PRAXA_API_KEY=... node durable-task.mjs <task>");
    process.exitCode = 2;
    return;
  }

  const run = await submitTask({ apiKey, input, requestId: randomUUID() });
  console.log("admitted", run.run_id, run.status);
  const terminal = await waitForTerminal(run, apiKey);
  console.log("terminal", terminal.run_id, terminal.status);
  if (terminal.failure) console.error(terminal.failure);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
