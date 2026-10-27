import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const RUNTIME_ROOT = resolve(REPO_ROOT, "agent-runtime");

/** AGENT_CREDENTIAL_KEY as 32 bytes, from 64 hex characters or base64. */
export function parseKey(value) {
  const text = (value ?? "").trim();
  const bytes = /^[0-9a-f]{64}$/i.test(text) ? Buffer.from(text, "hex") : Buffer.from(text, "base64");
  if (bytes.length !== 32) throw new Error("AGENT_CREDENTIAL_KEY must be 32 bytes (64 hex characters)");
  return bytes;
}

/** Runtime settings from the environment. The repo root .env is loaded first when present. */
export function loadConfig(env = process.env, { loadEnvFile = true } = {}) {
  if (loadEnvFile) {
    try {
      process.loadEnvFile(join(REPO_ROOT, ".env"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const key = env.AGENT_CREDENTIAL_KEY?.trim();
  return {
    host: env.AGENT_RUNTIME_HOST || "127.0.0.1",
    port: Number(env.AGENT_RUNTIME_PORT || 8090),
    token: env.AGENT_RUNTIME_TOKEN || "",
    stateDir: resolve(REPO_ROOT, env.AGENT_STATE_DIR || ".agent-state"),
    credentialKey: key ? parseKey(key) : null,
    model: env.AGENT_MODEL || "gpt-5.5",
    backendUrl: (env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, ""),
    maxTurns: Number(env.AGENT_MAX_TURNS || 12),
  };
}
