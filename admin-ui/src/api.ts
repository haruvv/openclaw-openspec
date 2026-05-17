export const apiCache = new Map<string, unknown>();

export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(adminApiRequestPath(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = (await readJsonResponse(res)) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API error: ${res.status}`);
  return json;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(adminApiRequestPath(path), { credentials: "same-origin" });
  const json = (await readJsonResponse(res)) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API error: ${res.status}`);
  return json;
}

export async function apiPut<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(adminApiRequestPath(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = (await readJsonResponse(res)) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API error: ${res.status}`);
  return json;
}

export function adminApiRequestPath(path: string): string {
  if (path === "/api/admin") return "/admin/api";
  if (path.startsWith("/api/admin/")) return `/admin/api/${path.slice("/api/admin/".length)}`;
  return path;
}

async function readJsonResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json();
  const text = await res.text();
  return { error: text.trim() || `API error: ${res.status}` };
}
