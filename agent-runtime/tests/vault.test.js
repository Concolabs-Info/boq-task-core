import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createFileCredentialStore } from "../src/vault.js";

const CREDENTIAL = { type: "oauth", access: "secret-access", refresh: "secret-refresh", expires: 1 };

async function tempFile() {
  return join(await mkdtemp(join(tmpdir(), "vault-")), "credentials.enc");
}

test("vault round-trips through a new store and the file is not plaintext", async () => {
  const file = await tempFile();
  const key = randomBytes(32);
  const store = createFileCredentialStore(file, key);
  await store.modify("openai-codex", async () => CREDENTIAL);

  const reopened = createFileCredentialStore(file, key);
  assert.deepEqual(await reopened.read("openai-codex"), CREDENTIAL);
  const raw = await readFile(file, "utf8");
  assert.ok(!raw.includes("secret-access"));
  assert.ok(!raw.includes("secret-refresh"));
});

test("read of an empty vault is undefined", async () => {
  const store = createFileCredentialStore(await tempFile(), randomBytes(32));
  assert.equal(await store.read("openai-codex"), undefined);
  assert.deepEqual(await store.list(), []);
});

test("modify returning undefined leaves the credential unchanged", async () => {
  const store = createFileCredentialStore(await tempFile(), randomBytes(32));
  await store.modify("openai-codex", async () => CREDENTIAL);
  const result = await store.modify("openai-codex", async () => undefined);
  assert.deepEqual(result, CREDENTIAL);
  assert.deepEqual(await store.read("openai-codex"), CREDENTIAL);
});

test("concurrent modify calls are serialized", async () => {
  const store = createFileCredentialStore(await tempFile(), randomBytes(32));
  await store.modify("counter", async () => ({ type: "api_key", key: "0" }));
  await Promise.all(
    Array.from({ length: 10 }, () =>
      store.modify("counter", async (current) => ({ type: "api_key", key: String(Number(current.key) + 1) })),
    ),
  );
  assert.equal((await store.read("counter")).key, "10");
});

test("list returns provider ids and types without secrets", async () => {
  const store = createFileCredentialStore(await tempFile(), randomBytes(32));
  await store.modify("openai-codex", async () => CREDENTIAL);
  assert.deepEqual(await store.list(), [{ providerId: "openai-codex", type: "oauth" }]);
});

test("delete removes the credential", async () => {
  const store = createFileCredentialStore(await tempFile(), randomBytes(32));
  await store.modify("openai-codex", async () => CREDENTIAL);
  await store.delete("openai-codex");
  assert.equal(await store.read("openai-codex"), undefined);
});

test("a wrong key gives a clear error", async () => {
  const file = await tempFile();
  await createFileCredentialStore(file, randomBytes(32)).modify("openai-codex", async () => CREDENTIAL);
  await assert.rejects(
    createFileCredentialStore(file, randomBytes(32)).read("openai-codex"),
    /could not be decrypted/,
  );
});
