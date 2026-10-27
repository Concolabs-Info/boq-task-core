import { join } from "node:path";

import { loginWithDeviceCode } from "./auth.js";
import { createBackendClient } from "./backend.js";
import { loadConfig } from "./config.js";
import { createAppModels, probeModels, runtimeHealth } from "./models.js";
import { createServer } from "./server.js";
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
} else if (process.argv.includes("--models")) {
  if ((await runtimeHealth(models)) !== "ready") {
    console.error("Log in first with npm run auth.");
    process.exit(1);
  }
  console.log("Checking which Codex models your account can use...");
  for (const result of await probeModels(models)) {
    const mark = result.id === config.model ? " (AGENT_MODEL)" : "";
    console.log(`${result.ok ? "ok  " : "no  "} ${result.id}${mark}${result.ok ? "" : `  ${result.error}`}`);
  }
} else {
  if (!config.token) {
    console.error("Set AGENT_RUNTIME_TOKEN in .env first. The backend uses the same value.");
    process.exit(1);
  }
  const backend = createBackendClient({ baseUrl: config.backendUrl, token: config.token });
  const server = createServer({ config, models, backend });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${config.port} is already in use. Stop the other process or set AGENT_RUNTIME_PORT in .env.`);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  });
  server.listen(config.port, config.host, async () => {
    const health = await runtimeHealth(models);
    console.log(`Agent runtime listening on http://${config.host}:${config.port} (${health})`);
    if (health !== "ready") console.log("Run npm run auth to log in with your ChatGPT account.");
  });
  const stop = () => server.close(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
