import assert from "node:assert/strict";
import test from "node:test";

import { createServer } from "../src/server.js";

const TOKEN = "secret";
const BODY = {
  project_id: "p1",
  frame_version: 1,
  element: "example_pad_footing",
  page_id: "pg1",
  bbox: [0, 0, 10, 10],
  schema: { type: "object", properties: {} },
  prompt_file: null,
};

async function start({ health = "ready", runSessionImpl, token = TOKEN, model = { id: "m" } } = {}) {
  const models = { checkAuth: async () => (health === "ready" ? { type: "oauth" } : undefined) };
  const server = createServer({
    config: { token, model: "m", maxTurns: 3 },
    models,
    backend: {},
    getModel: () => model,
    runSessionImpl:
      runSessionImpl ??
      (async ({ emit }) => {
        emit({ type: "text", text: "reading" });
        return { status: "accepted", ids: ["o1"] };
      }),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base };
}

const auth = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

test("/health needs no token and reports login state", async (t) => {
  const { server, base } = await start({ health: "login_required" });
  t.after(() => server.close());
  const response = await fetch(`${base}/health`);
  assert.deepEqual(await response.json(), { status: "login_required" });
});

test("/runs needs the token", async (t) => {
  const { server, base } = await start();
  t.after(() => server.close());
  const response = await fetch(`${base}/runs`, { method: "POST", body: JSON.stringify(BODY) });
  assert.equal(response.status, 401);
});

test("an empty configured token refuses everything", async (t) => {
  const { server, base } = await start({ token: "" });
  t.after(() => server.close());
  const response = await fetch(`${base}/runs`, {
    method: "POST",
    headers: { Authorization: "Bearer ", "Content-Type": "application/json" },
    body: JSON.stringify(BODY),
  });
  assert.equal(response.status, 401);
});

test("an invalid run request is 400", async (t) => {
  const { server, base } = await start();
  t.after(() => server.close());
  const response = await fetch(`${base}/runs`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ ...BODY, bbox: [1, 2] }),
  });
  assert.equal(response.status, 400);
});

test("an unknown model is 500 with a clear message", async (t) => {
  const { server, base } = await start({ model: null });
  t.after(() => server.close());
  const response = await fetch(`${base}/runs`, { method: "POST", headers: auth, body: JSON.stringify(BODY) });
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /AGENT_MODEL/);
});

test("a run streams its events and ends with the result", async (t) => {
  const { server, base } = await start();
  t.after(() => server.close());
  const created = await fetch(`${base}/runs`, { method: "POST", headers: auth, body: JSON.stringify(BODY) });
  assert.equal(created.status, 202);
  const { run_id: runId } = await created.json();

  const events = await fetch(`${base}/runs/${runId}/events`, { headers: auth });
  assert.match(events.headers.get("content-type"), /text\/event-stream/);
  const text = await events.text();
  assert.match(text, /event: text\ndata: {"type":"text","text":"reading"}/);
  assert.match(text, /event: result\ndata: {"type":"result","status":"accepted","ids":\["o1"\]}/);
});

test("a crashing run still ends with a failed result", async (t) => {
  const { server, base } = await start({
    runSessionImpl: async () => {
      throw new Error("boom");
    },
  });
  t.after(() => server.close());
  const { run_id: runId } = await (
    await fetch(`${base}/runs`, { method: "POST", headers: auth, body: JSON.stringify(BODY) })
  ).json();
  const text = await (await fetch(`${base}/runs/${runId}/events`, { headers: auth })).text();
  assert.match(text, /"status":"failed","reason":"boom"/);
});

test("unknown run is 404", async (t) => {
  const { server, base } = await start();
  t.after(() => server.close());
  assert.equal((await fetch(`${base}/runs/nope/events`, { headers: auth })).status, 404);
});
