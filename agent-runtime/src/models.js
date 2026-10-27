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
