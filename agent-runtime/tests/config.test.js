import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { InMemoryCredentialStore } from "@earendil-works/pi-ai";

import { deviceCodeInteraction } from "../src/auth.js";
import { loadConfig, parseKey } from "../src/config.js";
import { createAppModels, runtimeHealth } from "../src/models.js";

test("parseKey accepts 64 hex characters and base64 of 32 bytes", () => {
  const bytes = randomBytes(32);
  assert.deepEqual(parseKey(bytes.toString("hex")), bytes);
  assert.deepEqual(parseKey(bytes.toString("base64")), bytes);
});

test("parseKey rejects short or empty keys", () => {
  assert.throws(() => parseKey("abcd"), /AGENT_CREDENTIAL_KEY must be 32 bytes/);
  assert.throws(() => parseKey(""), /AGENT_CREDENTIAL_KEY must be 32 bytes/);
});

test("loadConfig defaults", () => {
  const config = loadConfig({}, { loadEnvFile: false });
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 8090);
  assert.equal(config.backendUrl, "http://127.0.0.1:8000");
  assert.equal(config.maxTurns, 12);
  assert.equal(config.credentialKey, null);
  assert.equal(config.model, "gpt-5.6-terra");
  assert.ok(config.stateDir.endsWith(".agent-state"));
});

test("loadConfig reads the environment", () => {
  const key = randomBytes(32).toString("hex");
  const config = loadConfig(
    {
      AGENT_RUNTIME_PORT: "9100",
      AGENT_RUNTIME_TOKEN: "tok",
      AGENT_CREDENTIAL_KEY: key,
      AGENT_MODEL: "gpt-5.6-luna",
      AGENT_MAX_TURNS: "5",
      BACKEND_URL: "http://localhost:9000/",
    },
    { loadEnvFile: false },
  );
  assert.equal(config.port, 9100);
  assert.equal(config.token, "tok");
  assert.equal(config.credentialKey.toString("hex"), key);
  assert.equal(config.model, "gpt-5.6-luna");
  assert.equal(config.maxTurns, 5);
  assert.equal(config.backendUrl, "http://localhost:9000");
});

test("device code interaction picks device code and prints the code", async () => {
  const lines = [];
  const interaction = deviceCodeInteraction({ write: (text) => lines.push(text) });
  const choice = await interaction.prompt({
    type: "select",
    message: "Select OpenAI Codex login method:",
    options: [
      { id: "browser", label: "Browser login (default)" },
      { id: "device_code", label: "Device code login (headless)" },
    ],
  });
  assert.equal(choice, "device_code");
  interaction.notify({ type: "device_code", userCode: "ABCD-1234", verificationUri: "https://example.test/device" });
  const output = lines.join("");
  assert.match(output, /ABCD-1234/);
  assert.match(output, /https:\/\/example\.test\/device/);
});

test("device code interaction refuses other prompts", async () => {
  const interaction = deviceCodeInteraction({ write: () => {} });
  await assert.rejects(interaction.prompt({ type: "text", message: "Paste code" }), /device code/);
});

test("health is login_required without a credential and ready with one", async () => {
  const store = new InMemoryCredentialStore();
  const models = createAppModels(store);
  assert.equal(await runtimeHealth(models), "login_required");
  await store.modify("openai-codex", async () => ({
    type: "oauth",
    access: "a",
    refresh: "r",
    expires: Date.now() + 3_600_000,
  }));
  assert.equal(await runtimeHealth(models), "ready");
});
