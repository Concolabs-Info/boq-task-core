import { Type } from "@earendil-works/pi-ai";

export const definition = {
  name: "read_project",
  description: "Read the project frame: pages with their size and scale, and the storeys with their levels.",
  parameters: Type.Object({}),
};

export async function run(args, { backend, request }) {
  const frame = await backend.getFrame(request.project_id);
  const pages = frame.pages.map((page) => ({
    page_id: page.page_id,
    page_number: page.page_index + 1,
    size_px: [page.width_px, page.height_px],
    metres_per_pixel: page.metres_per_pixel ?? "no scale set",
  }));
  const summary = {
    frame_version: frame.version,
    target: { page_id: request.page_id, bbox: request.bbox },
    pages,
    storeys: frame.storeys,
  };
  return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }], isError: false };
}
