import { Type } from "@earendil-works/pi-ai";

/** The submit tool's parameters embed the element's own observation schema, so the model sees exact fields. */
export function definitionFor(schema) {
  return {
    name: "submit_observations",
    description:
      "Submit everything you read, once. Each observation has a storey name, optionally the box it came from, " +
      "and values that follow the element schema. All values in metres.",
    parameters: Type.Object({
      observations: Type.Array(
        Type.Object({
          storey: Type.Optional(Type.String({ description: "A storey name from read_project" })),
          geometry: Type.Optional(
            Type.Object({
              page_id: Type.String(),
              bbox: Type.Array(Type.Number(), { minItems: 4, maxItems: 4 }),
            }),
          ),
          values: Type.Unsafe(schema),
        }),
      ),
    }),
  };
}

export async function run({ observations }, { backend, request, state }) {
  const result = await backend.submitObservations(
    request.project_id,
    request.element,
    request.frame_version,
    observations ?? [],
  );
  if (result.ok) {
    state.accepted = result.ids;
    return { content: [{ type: "text", text: `Saved ${result.ids.length} observation(s).` }], isError: false };
  }
  state.failedSubmits += 1;
  return {
    content: [
      {
        type: "text",
        text: `Nothing was saved. Fix these problems and submit all observations again:\n${JSON.stringify(result.errors, null, 2)}`,
      },
    ],
    isError: true,
  };
}
