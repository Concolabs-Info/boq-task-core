/** Client for the backend's /internal routes. */
export function createBackendClient({ baseUrl, token, fetch = globalThis.fetch }) {
  const headers = { Authorization: `Bearer ${token}` };

  async function failure(response) {
    let detail = response.statusText;
    try {
      detail = JSON.stringify((await response.json()).detail);
    } catch {
      // keep the status text
    }
    return new Error(`Backend returned ${response.status}: ${detail}`);
  }

  return {
    async getFrame(projectId) {
      const response = await fetch(`${baseUrl}/internal/projects/${projectId}/frame`, { headers });
      if (!response.ok) throw await failure(response);
      return response.json();
    },

    /** A region of a page render as base64 PNG. bbox is [x0, y0, x1, y1] in render pixels. */
    async crop(pageId, bbox) {
      const [x0, y0, x1, y1] = bbox;
      const query = new URLSearchParams({ x0, y0, x1, y1 });
      const response = await fetch(`${baseUrl}/internal/pages/${pageId}/crop?${query}`, { headers });
      if (!response.ok) throw await failure(response);
      return Buffer.from(await response.arrayBuffer()).toString("base64");
    },

    /** Returns { ok: true, ids } or { ok: false, errors } when the backend rejects the observations. */
    async submitObservations(projectId, element, frameVersion, observations) {
      const response = await fetch(`${baseUrl}/internal/projects/${projectId}/elements/${element}/observations`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ frame_version: frameVersion, observations }),
      });
      if (response.ok) return { ok: true, ids: (await response.json()).ids };
      if (response.status === 422 || response.status === 409) {
        const detail = (await response.json()).detail;
        return { ok: false, errors: detail?.errors ?? [{ detail }] };
      }
      throw await failure(response);
    },
  };
}
