import { createModels } from "@earendil-works/pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";

export const PROVIDER = "openai-codex";

/** A pi-ai Models collection with only the Codex provider, using the given credential store. */
export function createAppModels(credentials) {
  const models = createModels({ credentials });
  models.setProvider(openaiCodexProvider());
  return models;
}

/** "ready" when a Codex login is stored, otherwise "login_required". */
export async function runtimeHealth(models) {
  try {
    return (await models.checkAuth(PROVIDER)) ? "ready" : "login_required";
  } catch {
    return "login_required";
  }
}

/** Sends a tiny request to every catalog model of a provider and reports which ones this login can use. */
export async function probeModels(models, provider = PROVIDER) {
  const results = [];
  for (const model of models.getModels(provider)) {
    try {
      const reply = await models.complete(model, {
        messages: [{ role: "user", content: "Reply with OK.", timestamp: Date.now() }],
      });
      const failed = reply.stopReason === "error" || reply.stopReason === "aborted";
      results.push({ id: model.id, ok: !failed, error: failed ? reply.errorMessage || "request failed" : null });
    } catch (error) {
      results.push({ id: model.id, ok: false, error: error.message });
    }
  }
  return results;
}
