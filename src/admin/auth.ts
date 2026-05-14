import type { Request, Response } from "express";

export function isAdminAuthorized(req: Request, res: Response): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return process.env.NODE_ENV !== "production";

  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
  if (queryToken === token) {
    res.cookie("admin_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    return true;
  }

  const cookieToken = parseCookie(req.headers.cookie ?? "").admin_token;
  return cookieToken === token;
}

export function isAdminTokenConfigured(): boolean {
  return typeof process.env.ADMIN_TOKEN === "string" && process.env.ADMIN_TOKEN.length > 0;
}

export function renderAdminLogin(returnTo: string): string {
  return `
    <form method="get" action="${escapeHtml(returnTo.split("?")[0] || "/admin")}">
      <label>管理トークン <input name="token" type="password" autocomplete="current-password" /></label>
      <button type="submit">開く</button>
    </form>
  `;
}

function parseCookie(cookie: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookie.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || rawValue.length === 0) continue;
    out[rawKey] = decodeURIComponent(rawValue.join("="));
  }
  return out;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
