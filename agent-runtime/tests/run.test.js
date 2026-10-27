import assert from "node:assert/strict";
import test from "node:test";

import { createModels, fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai";

import { buildSystemPrompt, runSession } from "../src/run.js";

const SCHEMA = {
  title: "PadFooting",
  type: "object",
  properties: { mark: { type: "string" }, depth_m: { type: "number" } },
  required: ["mark", "depth_m"],
};

const REQUEST = {
  project_id: "p1",
  frame_version: 1,
  element: "example_pad_footing",
  page_id: "pg1",
  bbox: [0, 0, 200, 100],
  schema: SCHEMA,
  prompt_file: "example_pad_footing.md",
};

const GOOD = [{ storey: "Ground", values: { mark: "F1", depth_m: 0.6 } }];

function fakeBackend({ accept = true } = {}) {
  const backend = {
    saved: [],
    crops: [],
    async getFrame() {
      return { version: 1, pages: [{ page_id: "pg1", width_px: 1000, height_px: 800, metres_per_pixel: 0.01 }], storeys: [] };
    },
    async crop(pageId, bbox) {
      backend.crops.push([pageId, bbox]);
      return Buffer.from("png").toString("base64");
    },
    async submitObservations(projectId, element, frameVersion, observations) {
      if (!accept) return { ok: false, errors: [{ index: 0, detail: "depth_m is required" }] };
      backend.saved.push(...observations);
      return { ok: true, ids: observations.map((_, index) => `obs${index}`) };
    },
  };
  return backend;
}

function setup(responses) {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses(responses);
  return { models, model: faux.getModel() };
}

const call = (name, args) => fauxAssistantMessage([fauxToolCall(name, args)], { stopReason: "toolUse" });
const readPrompt = async (file) => (file === "element-reader.md" ? "BASE PROMPT" : "ELEMENT PROMPT");

function run(responses, backend, options = {}) {
  const events = [];
  const result = runSession({
    ...setup(responses),
    backend,
    request: REQUEST,
    emit: (event) => events.push(event),
    maxTurns: 6,
    readPrompt,
    ...options,
  });
  return { result, events };
}

test("accepted on the first valid submit", async () => {
  const backend = fakeBackend();
  const { result, events } = run(
    [call("read_project", {}), call("submit_observations", { observations: GOOD })],
    backend,
  );
  assert.deepEqual(await result, { status: "accepted", ids: ["obs0"] });
  assert.deepEqual(backend.saved, GOOD);
  assert.deepEqual(backend.crops[0], ["pg1", [0, 0, 200, 100]]);
  assert.deepEqual(
    events.filter((e) => e.type === "tool").map((e) => e.name),
    ["read_project", "submit_observations"],
  );
});

test("a rejected submit can be fixed once", async () => {
  let attempts = 0;
  const backend = fakeBackend();
  const submit = backend.submitObservations;
  backend.submitObservations = async (...args) => {
    attempts += 1;
    return attempts === 1 ? { ok: false, errors: [{ index: 0, detail: "bad" }] } : submit(...args);
  };
  const { result } = run(
    [call("submit_observations", { observations: GOOD }), call("submit_observations", { observations: GOOD })],
    backend,
  );
  assert.equal((await result).status, "accepted");
});

test("fails after two rejected submits and nothing is saved", async () => {
  const backend = fakeBackend({ accept: false });
  const { result } = run(
    [call("submit_observations", { observations: GOOD }), call("submit_observations", { observations: GOOD })],
    backend,
  );
  assert.deepEqual(await result, { status: "failed", reason: "observations were rejected twice" });
  assert.deepEqual(backend.saved, []);
});

test("fails when the agent stops without submitting", async () => {
  const { result, events } = run([fauxAssistantMessage([fauxText("I see a footing.")])], fakeBackend());
  assert.deepEqual(await result, { status: "failed", reason: "agent stopped without submitting" });
  assert.deepEqual(events.find((e) => e.type === "text"), { type: "text", text: "I see a footing." });
});

test("fails at the turn limit", async () => {
  const { result } = run([call("read_project", {}), call("read_project", {})], fakeBackend(), { maxTurns: 2 });
  assert.deepEqual(await result, { status: "failed", reason: "turn limit reached" });
});

test("a backend failure ends the run with its message", async () => {
  const backend = fakeBackend();
  backend.crop = async () => {
    throw new Error("backend is down");
  };
  const { result } = run([call("read_project", {})], backend);
  assert.deepEqual(await result, { status: "failed", reason: "backend is down" });
});

test("unknown tools get an error result instead of crashing", async () => {
  const backend = fakeBackend();
  const { result } = run(
    [call("delete_everything", {}), call("submit_observations", { observations: GOOD })],
    backend,
  );
  assert.equal((await result).status, "accepted");
});

test("system prompt joins base prompt, element prompt and schema", async () => {
  const prompt = await buildSystemPrompt(REQUEST, readPrompt);
  assert.match(prompt, /^BASE PROMPT/);
  assert.match(prompt, /ELEMENT PROMPT/);
  assert.match(prompt, /"required":\["mark","depth_m"\]/);
});

test("element prompt file names cannot leave the prompts folder", async () => {
  const { readPromptFile } = await import("../src/run.js");
  await assert.rejects(readPromptFile("../package.json"), /Invalid prompt file/);
  assert.match(await readPromptFile("element-reader.md"), /submit_observations/);
});
