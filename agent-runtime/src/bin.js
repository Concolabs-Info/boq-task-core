import { join } from "node:path";

import { loginWithDeviceCode } from "./auth.js";
import { loadConfig } from "./config.js";
import { createAppModels, runtimeHealth } from "./models.js";
import { createFileCredentialStore } from "./vault.js";

const config = loadConfig();
if (!config.credentialKey) {
  console.error("Set AGENT_CREDENTIAL_KEY in .env first. See .env.example for how to generate one.");
  process.exit(1);
}
const models = createAppModels(createFileCredentialStore(join(config.stateDir, "credentials.enc"), config.credentialKey));

if (process.argv.includes("--auth")) {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort(new Error("Login cancelled")));
  await loginWithDeviceCode(models, process.stdout, controller.signal);
  console.log("Logged in.");
} else if (process.argv.includes("--health")) {
  console.log(JSON.stringify({ status: await runtimeHealth(models) }));
}
