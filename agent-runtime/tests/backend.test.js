import assert from "node:assert/strict";
import test from "node:test";

import { createBackendClient } from "../src/backend.js";

function client(status, body, seen = {}) {
  return createBackendClient({
    baseUrl: "http://backend",
    token: "tok",
    fetch: async (url, init = {}) => {
      seen.url = url;
      seen.headers = init.headers;
      seen.body = init.body;
      return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
    },
  });
}

test("submit maps 200 to ok with ids and sends the frame version", async () => {
  const seen = {};
  const result = await client(200, { ids: ["a"] }, seen).submitObservations("p1", "el", 3, [{ values: {} }]);
  assert.deepEqual(result, { ok: true, ids: ["a"] });
  assert.equal(seen.url, "http://backend/internal/projects/p1/elements/el/observations");
  assert.equal(seen.headers.Authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(seen.body), { frame_version: 3, observations: [{ values: {} }] });
});

test("submit maps 422 errors to ok false", async () => {
  const errors = [{ index: 0, detail: "bad" }];
  const result = await client(422, { detail: { errors } }).submitObservations("p1", "el", 1, []);
  assert.deepEqual(result, { ok: false, errors });
});

test("submit maps a 409 frame change to ok false", async () => {
  const result = await client(409, { detail: "The frame changed" }).submitObservations("p1", "el", 1, []);
  assert.deepEqual(result, { ok: false, errors: [{ detail: "The frame changed" }] });
});

test("other failures throw with the backend detail", async () => {
  await assert.rejects(client(500, { detail: "db locked" }).getFrame("p1"), /Backend returned 500: "db locked"/);
});

test("crop returns base64 and passes the box as query", async () => {
  const seen = {};
  const data = await client(200, "png-bytes", seen).crop("pg", [1, 2, 3, 4]);
  assert.equal(Buffer.from(data, "base64").toString(), "png-bytes");
  assert.equal(seen.url, "http://backend/internal/pages/pg/crop?x0=1&y0=2&x1=3&y1=4");
});
