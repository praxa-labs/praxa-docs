import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bin = path.join(root, "node_modules", ".bin", "praxa");

function run(args, cwd = root) {
  return spawnSync(bin, args, { cwd, encoding: "utf8" });
}

test("reports the exact public CLI contract", () => {
  const result = run(["version"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    cliVersion: "0.3.0",
    openapiVersion: "8.1.0",
    contractVersion: "aura-integration-gateway-v8.1",
    openapiSha256: "a9835faa4654246f83c452ae968a569c85be28f93017882e710ca35c10dbbecc",
  });
});

test("memory planning is read-only and writes no project file", async () => {
  const project = await mkdtemp(path.join(tmpdir(), "praxa-docs-cli-"));
  try {
    const source = run(
      ["memory", "source", "add", "mem0", "--mode", "federated", "--dry-run"],
      project,
    );
    assert.equal(source.status, 0, source.stderr);
    const sourcePlan = JSON.parse(source.stdout);
    assert.equal(sourcePlan.source.provider, "mem0");
    assert.equal(sourcePlan.source.access, "read_only");
    assert.equal(sourcePlan.execution, "local_configuration_only");

    const sync = run(["memory", "sync", "plan", "--dry-run"], project);
    assert.equal(sync.status, 0, sync.stderr);
    assert.equal(JSON.parse(sync.stdout).executable, false);
    assert.equal(existsSync(path.join(project, ".praxa")), false);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});
