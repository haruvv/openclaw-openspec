import type { Request, Response } from "express";
import {
  cloudflareAccessConfigForAdmin,
  isCloudflareAccessEnabled,
  logCloudflareAccessFailure,
  validateCloudflareAccessHeader,
} from "../security/cloudflare-access.js";

export type AdminAuthorizationResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string; reason: "access" | "token" | "configuration" };

export async function authorizeAdminRequest(req: Request, res?: Response): Promise<AdminAuthorizationResult> {
  const accessConfig = cloudflareAccessConfigForAdmin();
  if (accessConfig.enabled) {
    const access = await validateCloudflareAccessHeader(req.headers["cf-access-jwt-assertion"], accessConfig, "admin");
    if (access.ok) return { ok: true };
    logCloudflareAccessFailure(req.originalUrl ?? req.url, access.status);

    if (!allowAdminTokenFallback() || !isAdminTokenAuthorized(req, res)) {
      return { ok: false, status: access.status, error: access.body.error, reason: "access" };
    }
    return { ok: true };
  }

  if (isAdminTokenAuthorized(req, res)) return { ok: true };

  if (!isAdminTokenConfigured() && process.env.NODE_ENV === "production") {
    return { ok: false, status: 503, error: "admin_auth_not_configured", reason: "configuration" };
  }

  return { ok: false, status: 401, error: "admin_token_required", reason: "token" };
}

export function isAdminAuthorized(req: Request, res: Response): boolean {
  return !isCloudflareAccessEnabled() && isAdminTokenAuthorized(req, res);
}

function isAdminTokenAuthorized(req: Request, res?: Response): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return process.env.NODE_ENV !== "production";

  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
  if (queryToken === token && isAdminTokenQueryAllowed()) {
    res?.cookie("admin_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    return true;
  }

  const cookieToken = parseCookie(req.headers.cookie ?? "").admin_token;
  return cookieToken === token;
}

export function isAdminTokenConfigured(): boolean {
  return typeof process.env.ADMIN_TOKEN === "string" && process.env.ADMIN_TOKEN.length > 0;
}

export function isAdminTokenQueryAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (!isCloudflareAccessEnabled()) return true;
  return allowAdminTokenFallback();
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

function allowAdminTokenFallback(): boolean {
  return process.env.CLOUDFLARE_ACCESS_ALLOW_ADMIN_TOKEN_FALLBACK === "true";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
