import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { RUNTIME_ROOT } from "./config.js";
import * as crop from "./tools/crop.js";
import * as readProject from "./tools/read-project.js";
import * as submitObservations from "./tools/submit-observations.js";

const PROMPTS_DIR = join(RUNTIME_ROOT, "prompts");
const BASE_PROMPT = "element-reader.md";
const MAX_FAILED_SUBMITS = 2;

export async function readPromptFile(file) {
  if (!/^[A-Za-z0-9_-]+\.md$/.test(file)) throw new Error(`Invalid prompt file: ${file}`);
  return readFile(join(PROMPTS_DIR, file), "utf8");
}

export async function buildSystemPrompt(request, readPrompt = readPromptFile) {
  const parts = [await readPrompt(BASE_PROMPT)];
  if (request.prompt_file) parts.push(await readPrompt(request.prompt_file));
  parts.push(`Observation values JSON Schema:\n${JSON.stringify(request.schema)}`);
  return parts.join("\n\n");
}

/**
 * One agent run: show the model the boxed drawing area, let it use the tools, and stop when
 * its observations are accepted, it gives up, a submit is rejected twice, or turns run out.
 */
export async function runSession({
  models,
  model,
  backend,
  request,
  emit = () => {},
  maxTurns = 12,
  readPrompt = readPromptFile,
}) {
  const state = { accepted: null, failedSubmits: 0 };
  const tools = new Map([
    [readProject.definition.name, readProject],
    [crop.definition.name, crop],
    ["submit_observations", submitObservations],
  ]);

  try {
    const image = await backend.crop(request.page_id, request.bbox);
    const context = {
      systemPrompt: await buildSystemPrompt(request, readPrompt),
      tools: [readProject.definition, crop.definition, submitObservations.definitionFor(request.schema)],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Read the ${request.element} element in this box on page ${request.page_id}, ` +
                `bbox [${request.bbox.join(", ")}] in render pixels. The image below is that box.`,
            },
            { type: "image", data: image, mimeType: "image/png" },
          ],
          timestamp: Date.now(),
        },
      ],
    };

    for (let turn = 0; turn < maxTurns; turn += 1) {
      const reply = await models.complete(model, context);
      if (reply.stopReason === "error" || reply.stopReason === "aborted") {
        return { status: "failed", reason: reply.errorMessage || "model request failed" };
      }
      context.messages.push(reply);
      for (const block of reply.content) {
        if (block.type === "text" && block.text.trim()) emit({ type: "text", text: block.text });
      }

      const calls = reply.content.filter((block) => block.type === "toolCall");
      if (calls.length === 0) return { status: "failed", reason: "agent stopped without submitting" };

      for (const toolCall of calls) {
        const tool = tools.get(toolCall.name);
        const result = tool
          ? await tool.run(toolCall.arguments ?? {}, { backend, request, state })
          : { content: [{ type: "text", text: `Unknown tool: ${toolCall.name}` }], isError: true };
        emit({ type: "tool", name: toolCall.name, isError: result.isError });
        context.messages.push({
          role: "toolResult",
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: result.content,
          isError: result.isError,
          timestamp: Date.now(),
        });
      }

      if (state.accepted) return { status: "accepted", ids: state.accepted };
      if (state.failedSubmits >= MAX_FAILED_SUBMITS) {
        return { status: "failed", reason: "observations were rejected twice" };
      }
    }
    return { status: "failed", reason: "turn limit reached" };
  } catch (error) {
    return { status: "failed", reason: error.message };
  }
}
