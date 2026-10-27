import { Type } from "@earendil-works/pi-ai";

/**
 * The submit tool's parameters embed the element's own observation schema, so the model sees exact fields.
 * Pydantic puts enums and nested models under $defs with refs like "#/$defs/Kind". Those refs are
 * resolved from the root of the tool parameters, so $defs moves up to that root.
 */
export function definitionFor(schema) {
  const { $defs, ...values } = schema;
  const parameters = Type.Object({
    observations: Type.Array(
      Type.Object({
        storey: Type.Optional(Type.String({ description: "A storey name from read_project" })),
        geometry: Type.Optional(
          Type.Object({
            page_id: Type.String(),
            bbox: Type.Array(Type.Number(), { minItems: 4, maxItems: 4 }),
          }),
        ),
        values: Type.Unsafe(values),
      }),
    ),
  });
  return {
    name: "submit_observations",
    description:
      "Submit everything you read, once. Each observation has a storey name, optionally the box it came from, " +
      "and values that follow the element schema. All values in metres.",
    parameters: $defs ? { ...parameters, $defs } : parameters,
  };
}

export async function run({ observations }, { backend, request, state }) {
  if (state.accepted) {
    return { content: [{ type: "text", text: "Already saved. Do not submit again." }], isError: false };
  }
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
