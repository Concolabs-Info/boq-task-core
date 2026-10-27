import assert from "node:assert/strict";
import test from "node:test";

import { definition, run } from "../src/tools/read-vectors.js";

const VECTORS = {
  page_id: "pg1",
  layers: ["S-FOUNDATIONS", "A-TEXT"],
  text: [{ text: "F1 1500 x 1200", bbox: [100.4, 50.2, 180.9, 60.1] }],
  paths: [
    { kind: "rect", bbox: [354.2, 472.0, 443.1, 543.4], layer: "S-FOUNDATIONS", points: [] },
    { kind: "line", bbox: [10, 20, 110, 20], layer: null, points: [[10, 20], [110, 20]] },
  ],
  truncated: false,
};

test("read_vectors returns exact text, rectangles and layers from the PDF", async () => {
  const seen = {};
  const backend = {
    async vectors(pageId, bbox) {
      Object.assign(seen, { pageId, bbox });
      return VECTORS;
    },
  };
  assert.equal(definition.name, "read_vectors");
  const result = await run({ page_id: "pg1", x0: 0, y0: 0, x1: 500, y1: 600 }, { backend });
  assert.equal(result.isError, false);
  assert.deepEqual(seen, { pageId: "pg1", bbox: [0, 0, 500, 600] });
  const body = JSON.parse(result.content[0].text);
  assert.deepEqual(body.layers, ["S-FOUNDATIONS", "A-TEXT"]);
  assert.deepEqual(body.text, [{ text: "F1 1500 x 1200", bbox: [100, 50, 181, 60] }]);
  assert.deepEqual(body.rectangles, [{ layer: "S-FOUNDATIONS", bbox: [354, 472, 443, 543], width_px: 89, height_px: 71 }]);
  assert.deepEqual(body.lines_per_layer, { "(no layer)": 1 });
});

test("read_vectors reports backend failures as a tool error", async () => {
  const backend = {
    async vectors() {
      throw new Error("Backend returned 404");
    },
  };
  const result = await run({ page_id: "nope" }, { backend });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /404/);
});
