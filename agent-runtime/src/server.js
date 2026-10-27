import { randomUUID } from "node:crypto";
import http from "node:http";

import { PROVIDER, runtimeHealth } from "./models.js";
import { runSession } from "./run.js";

const MAX_KEPT_RUNS = 50;
const HEARTBEAT_MS = 15_000;

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function validRun(body) {
  return (
    typeof body.project_id === "string" &&
    typeof body.element === "string" &&
    typeof body.page_id === "string" &&
    Number.isInteger(body.frame_version) &&
    Array.isArray(body.bbox) &&
    body.bbox.length === 4 &&
    body.bbox.every((value) => typeof value === "number") &&
    typeof body.schema === "object" &&
    body.schema !== null
  );
}

function sse(event) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * HTTP server:
 *   GET  /health            no token; { status: "ready" | "login_required" }
 *   POST /runs              start a run, returns 202 { run_id }
 *   GET  /runs/:id/events   server-sent events: text, tool, then one result
 */
export function createServer({
  config,
  models,
  backend,
  getModel = () => models.getModel(PROVIDER, config.model),
  runSessionImpl = runSession,
}) {
  const runs = new Map();

  function authorized(request) {
    return Boolean(config.token) && request.headers.authorization === `Bearer ${config.token}`;
  }

  function startRun(body, model) {
    const id = randomUUID();
    const run = { events: [], listeners: new Set(), done: false };
    runs.set(id, run);
    if (runs.size > MAX_KEPT_RUNS) runs.delete(runs.keys().next().value);

    const emit = (event) => {
      run.events.push(event);
      for (const listener of run.listeners) listener(event);
    };
    runSessionImpl({ models, model, backend, request: body, emit, maxTurns: config.maxTurns })
      .catch((error) => ({ status: "failed", reason: error.message }))
      .then((result) => {
        run.done = true;
        emit({ type: "result", ...result });
      });
    return id;
  }

  function streamRun(run, request, response) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    for (const event of run.events) response.write(sse(event));
    if (run.done) return response.end();

    const heartbeat = setInterval(() => response.write(": ping\n\n"), HEARTBEAT_MS);
    const listener = (event) => {
      response.write(sse(event));
      if (event.type === "result") response.end();
    };
    run.listeners.add(listener);
    response.on("close", () => {
      clearInterval(heartbeat);
      run.listeners.delete(listener);
    });
  }

  async function route(request, response) {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { status: await runtimeHealth(models) });
    }
    if (!authorized(request)) return json(response, 401, { error: "Invalid agent runtime token" });

    if (request.method === "POST" && url.pathname === "/runs") {
      let body;
      try {
        body = await readJson(request);
      } catch {
        return json(response, 400, { error: "Body must be JSON" });
      }
      if (!validRun(body)) return json(response, 400, { error: "Invalid run request" });
      const model = getModel();
      if (!model) {
        return json(response, 500, {
          error: `Unknown model "${config.model}". Set AGENT_MODEL in .env to a model your Codex account can use.`,
        });
      }
      return json(response, 202, { run_id: startRun(body, model) });
    }

    const match = /^\/runs\/([^/]+)\/events$/.exec(url.pathname);
    if (request.method === "GET" && match) {
      const run = runs.get(match[1]);
      if (!run) return json(response, 404, { error: "Unknown run" });
      return streamRun(run, request, response);
    }
    return json(response, 404, { error: "Not found" });
  }

  return http.createServer((request, response) => {
    route(request, response).catch((error) => {
      if (!response.headersSent) json(response, 500, { error: error.message });
      else response.end();
    });
  });
}
