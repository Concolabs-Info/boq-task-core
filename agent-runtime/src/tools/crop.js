import { Type } from "@earendil-works/pi-ai";

export const definition = {
  name: "crop",
  description:
    "Look at another region of a page, for example a section or schedule. " +
    "Coordinates are render pixels (150 DPI), origin top left.",
  parameters: Type.Object({
    page_id: Type.String(),
    x0: Type.Number(),
    y0: Type.Number(),
    x1: Type.Number(),
    y1: Type.Number(),
  }),
};

export async function run({ page_id: pageId, x0, y0, x1, y1 }, { backend }) {
  try {
    const data = await backend.crop(pageId, [x0, y0, x1, y1]);
    return {
      content: [
        { type: "text", text: `Page ${pageId}, box [${x0}, ${y0}, ${x1}, ${y1}]` },
        { type: "image", data, mimeType: "image/png" },
      ],
      isError: false,
    };
  } catch (error) {
    return { content: [{ type: "text", text: `Crop failed: ${error.message}` }], isError: true };
  }
}
