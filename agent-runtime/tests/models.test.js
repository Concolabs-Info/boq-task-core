import assert from "node:assert/strict";
import test from "node:test";

import { createModels, fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";

import { probeModels } from "../src/models.js";

test("probeModels reports which catalog models answer", async () => {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  const ids = models.getModels(faux.getModel().provider).map((model) => model.id);
  faux.setResponses(
    ids.map((_, index) =>
      index === 0
        ? fauxAssistantMessage("OK")
        : fauxAssistantMessage([], { stopReason: "error", errorMessage: "not supported" }),
    ),
  );
  const results = await probeModels(models, faux.getModel().provider);
  assert.deepEqual(results[0], { id: ids[0], ok: true, error: null });
  if (results.length > 1) assert.deepEqual(results[1], { id: ids[1], ok: false, error: "not supported" });
});
