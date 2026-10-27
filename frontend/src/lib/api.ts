export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Turns a FastAPI error body into one readable line. */
function describe(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const loc = Array.isArray(item?.loc) ? item.loc.filter((part: unknown) => part !== "body").join(".") : "";
        return loc ? `${loc}: ${item.msg}` : (item?.msg ?? JSON.stringify(item));
      })
      .join("; ");
  }
  return JSON.stringify(detail);
}

async function handle<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }
  let message = response.statusText;
  try {
    message = describe((await response.json()).detail);
  } catch {
    // keep the status text
  }
  throw new ApiError(response.status, message);
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  return handle<T>(await fetch(apiUrl(path), { cache: "no-store" }));
}

export async function apiSend<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(apiUrl(path), {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export async function apiUpload<T>(path: string, files: File[]): Promise<T> {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  return handle<T>(await fetch(apiUrl(path), { method: "POST", body: form }));
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
