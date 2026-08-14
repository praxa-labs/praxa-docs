import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryFederation,
  MemorySourceUnavailableError,
} from "@praxa/sdk/memory";

const capabilities = {
  retrievalModes: ["exact"],
  recordKinds: ["fact"],
  readOnly: true,
  sourceLocalScores: true,
  supportsAbort: true,
  supportsFilter: false,
};

const healthy = {
  id: "profile",
  provider: "custom",
  capabilities,
  async recall() {
    return [{
      sourceRecordId: "preference-1",
      kind: "fact",
      text: "Prefers concise answers",
      provenance: {
        origin: "explicit",
        confidence: 1,
        capturedAt: "2026-08-14T12:00:00.000Z",
      },
    }];
  },
};

const unavailable = {
  id: "archive",
  provider: "custom",
  capabilities,
  async recall() {
    throw new MemorySourceUnavailableError("Archive unavailable");
  },
};

test("returns a source-labelled partial result", async () => {
  const federation = new MemoryFederation({ sources: [healthy, unavailable] });
  const result = await federation.recall({
    query: "answer style",
    namespace: { tenantId: "tenant-a", subjectId: "subject-1" },
  });

  assert.equal(result.status, "partial");
  assert.equal(result.items[0].text, "Prefers concise answers");
  assert.deepEqual(
    result.sources.map(({ sourceId, status }) => ({ sourceId, status })),
    [
      { sourceId: "profile", status: "ok" },
      { sourceId: "archive", status: "unavailable" },
    ],
  );
});
