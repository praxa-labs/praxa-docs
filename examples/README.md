# Praxa documentation examples

These small examples exercise the exact public package and HTTP contracts used
by the documentation.

## Install and test

~~~bash
npm install
npm run examples:test
~~~

The tests use in-process fakes. They do not need a Praxa credential and do not
make a network request.

## Run a live durable task

~~~bash
export PRAXA_API_KEY="praxa_sk_<redacted>"
node examples/execution-fabric/durable-task.mjs \
  "Summarize this incident and propose a safe next action."
~~~

The script submits the task, prints the run ID, and polls until terminal. Use a
disposable personal key with <code>execute:write</code> and
<code>runs:read</code>. A live run can consume quota.

## What each test proves

| Example | Proof |
|---|---|
| <code>execution-fabric/durable-task.test.mjs</code> | Request shape, stable idempotency, no-store behavior, and terminal polling |
| <code>sdk/quickstart.test.mjs</code> | Exact SDK mission path, bearer/contract/idempotency headers, and the public contract fingerprint |
| <code>memory-federation/custom-source.test.mjs</code> | Exact package import, provenance-preserving merge, and explicit partial degradation |
| <code>mcp/contracts.test.mjs</code> | Exact public package import, protocol versions, annotations, and 12 Aura-compatible wire names |
| <code>mcp/host-adapter.test.mjs</code> | Exact registration, path interpolation, schema/annotation identity, and bounded error projection |
| <code>api-playground/contracts.test.mjs</code> | All 15 active operations, pending-approval exclusion, and representative fail-closed problem examples |
| <code>cli/public-cli.test.mjs</code> | Exact version constants plus read-only memory dry runs that leave no project file |

These tests prove package and local adapter behavior. They do not prove live
tenant authorization, provider access, external effects, or production
performance.
