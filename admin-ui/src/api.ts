export const apiCache = new Map<string, unknown>();
const ADMIN_TOKEN_STORAGE_KEY = "revenue_agent_admin_token";

export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(withAdminToken(path), {
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
  const res = await fetch(withAdminToken(path), { credentials: "same-origin" });
  const json = (await readJsonResponse(res)) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API error: ${res.status}`);
  return json;
}

export async function apiPut<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(withAdminToken(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = (await readJsonResponse(res)) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `API error: ${res.status}`);
  return json;
}

async function readJsonResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json();
  const text = await res.text();
  return { error: text.trim() || `API error: ${res.status}` };
}

export function rememberAdminTokenFromUrl(): void {
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) return;
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // Session storage can be unavailable in hardened browsers; API calls will then require tokenized URLs.
  }
}

function readRememberedAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function withAdminToken(path: string): string {
  const token = readRememberedAdminToken();
  if (!token) return path;
  const url = new URL(path, window.location.origin);
  if (!url.searchParams.has("token")) url.searchParams.set("token", token);
  return `${url.pathname}${url.search}${url.hash}`;
}
