import test from "node:test";
import assert from "node:assert/strict";
import {
  MCP_LEGACY_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  PRAXA_MCP_TOOLS,
} from "@praxa/mcp-contracts";

test("loads the exact published MCP compatibility surface", () => {
  assert.equal(MCP_PROTOCOL_VERSION, "2025-11-25");
  assert.equal(MCP_LEGACY_PROTOCOL_VERSION, "2025-03-26");
  assert.equal(MCP_SERVER_NAME, "aura-agent-os");
  assert.equal(MCP_SERVER_VERSION, "0.3.0");
  assert.equal(PRAXA_MCP_TOOLS.length, 12);
  assert.ok(PRAXA_MCP_TOOLS.every((definition) => definition.name.startsWith("aura_")));
  assert.ok(PRAXA_MCP_TOOLS.every((definition) => definition.annotations));
});
