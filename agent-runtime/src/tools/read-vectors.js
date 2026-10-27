import { Type } from "@earendil-works/pi-ai";

const MAX_ITEMS = 150;

export const definition = {
  name: "read_vectors",
  description:
    "Read a region of a page straight from the PDF, with no image guessing: exact text lines (marks, dimensions, " +
    "schedule cells), rectangles from the drawing's vector paths, and the PDF layer names. Coordinates are render " +
    "pixels (150 DPI), origin top left. Leave out the box to read the whole page.",
  parameters: Type.Object({
    page_id: Type.String(),
    x0: Type.Optional(Type.Number()),
    y0: Type.Optional(Type.Number()),
    x1: Type.Optional(Type.Number()),
    y1: Type.Optional(Type.Number()),
  }),
};

const round = (values) => values.map((value) => Math.round(value));

export async function run({ page_id: pageId, x0, y0, x1, y1 }, { backend }) {
  const bbox = [x0, y0, x1, y1].every((value) => typeof value === "number") ? [x0, y0, x1, y1] : null;
  try {
    const vectors = await backend.vectors(pageId, bbox);
    const rectangles = vectors.paths
      .filter((path) => path.kind === "rect")
      .slice(0, MAX_ITEMS)
      .map((path) => ({
        layer: path.layer,
        bbox: round(path.bbox),
        width_px: Math.round(path.bbox[2] - path.bbox[0]),
        height_px: Math.round(path.bbox[3] - path.bbox[1]),
      }));
    const linesPerLayer = {};
    for (const path of vectors.paths.filter((p) => p.kind === "line")) {
      const key = path.layer ?? "(no layer)";
      linesPerLayer[key] = (linesPerLayer[key] ?? 0) + 1;
    }
    const summary = {
      layers: vectors.layers,
      text: vectors.text.slice(0, MAX_ITEMS).map((line) => ({ text: line.text, bbox: round(line.bbox) })),
      rectangles,
      lines_per_layer: linesPerLayer,
      truncated: vectors.truncated || vectors.text.length > MAX_ITEMS || rectangles.length >= MAX_ITEMS,
    };
    return { content: [{ type: "text", text: JSON.stringify(summary) }], isError: false };
  } catch (error) {
    return { content: [{ type: "text", text: `Could not read vectors: ${error.message}` }], isError: true };
  }
}
