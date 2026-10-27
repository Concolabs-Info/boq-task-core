import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const ALGORITHM = "aes-256-gcm";

function encrypt(key, document) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(document), "utf8"), cipher.final()]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}

function decrypt(key, text) {
  try {
    const file = JSON.parse(text);
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(file.iv, "base64"));
    decipher.setAuthTag(Buffer.from(file.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(file.data, "base64")), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  } catch {
    throw new Error("Credential file could not be decrypted. Check AGENT_CREDENTIAL_KEY or run npm run auth again.");
  }
}

/**
 * A pi-ai CredentialStore kept in one AES-256-GCM encrypted file.
 * Writes go through a single promise chain so they never overlap.
 */
export function createFileCredentialStore(path, key) {
  let chain = Promise.resolve();

  async function load() {
    let text;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw error;
    }
    return decrypt(key, text);
  }

  async function save(document) {
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.tmp`;
    await writeFile(temp, encrypt(key, document), { mode: 0o600 });
    await rename(temp, path);
  }

  function serialized(task) {
    const result = chain.then(task);
    chain = result.catch(() => undefined);
    return result;
  }

  return {
    async read(providerId) {
      return (await load())[providerId];
    },
    async list() {
      return Object.entries(await load()).map(([providerId, credential]) => ({ providerId, type: credential.type }));
    },
    modify(providerId, fn) {
      return serialized(async () => {
        const document = await load();
        const next = await fn(document[providerId]);
        if (next === undefined) return document[providerId];
        document[providerId] = next;
        await save(document);
        return next;
      });
    },
    delete(providerId) {
      return serialized(async () => {
        const document = await load();
        delete document[providerId];
        await save(document);
      });
    },
  };
}
