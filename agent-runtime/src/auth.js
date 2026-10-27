import { PROVIDER } from "./models.js";

/** Login interaction that always picks Codex device code login and prints the code. */
export function deviceCodeInteraction(out = process.stdout) {
  return {
    async prompt(prompt) {
      const device = prompt.type === "select" ? prompt.options.find((option) => option.id === "device_code") : null;
      if (!device) throw new Error(`Expected the device code login choice, got a ${prompt.type} prompt`);
      return device.id;
    },
    notify(event) {
      if (event.type === "device_code") {
        out.write(`\nOpen ${event.verificationUri} and enter this code: ${event.userCode}\n\n`);
      } else if (event.type === "info" || event.type === "progress") {
        out.write(`${event.message}\n`);
      } else if (event.type === "auth_url") {
        out.write(`Open: ${event.url}\n`);
      }
    },
  };
}

/** Log in with a ChatGPT account through Codex device code login. The credential is saved by the store. */
export async function loginWithDeviceCode(models, out = process.stdout, signal) {
  await models.login(PROVIDER, "oauth", { ...deviceCodeInteraction(out), signal });
}
