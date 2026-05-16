export type AccessSubjectKind = "admin" | "service";

export interface CloudflareAccessConfig {
  enabled: boolean;
  issuer?: string;
  audience?: string;
  certsUrl?: string;
  allowHumanForService?: boolean;
  allowServiceForAdmin?: boolean;
  fetcher?: typeof fetch;
}

export interface CloudflareAccessIdentity {
  kind: AccessSubjectKind;
  email?: string;
  serviceTokenId?: string;
  audience: string[];
  issuer: string;
}

export interface AccessFailure {
  ok: false;
  status: 401 | 503;
  body: { error: string };
}

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type AccessJwtPayload = {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  type?: string;
  email?: string;
  common_name?: string;
  service_token_id?: string;
  service_token_status?: boolean;
};

type Jwks = {
  keys?: JsonWebKey[];
};

const jwksCache = new Map<string, { fetchedAt: number; jwks: Jwks }>();
const jwksTtlMs = 10 * 60 * 1000;

export function cloudflareAccessConfigForAdmin(env: Record<string, string | undefined> = process.env): CloudflareAccessConfig {
  return {
    ...cloudflareAccessConfig(env, env.CLOUDFLARE_ACCESS_ADMIN_AUD),
    allowServiceForAdmin: env.CLOUDFLARE_ACCESS_ALLOW_SERVICE_ADMIN === "true",
  };
}

export function cloudflareAccessConfigForMachine(env: Record<string, string | undefined> = process.env): CloudflareAccessConfig {
  return {
    ...cloudflareAccessConfig(env, env.CLOUDFLARE_ACCESS_MACHINE_AUD),
    allowHumanForService: env.CLOUDFLARE_ACCESS_ALLOW_HUMAN_RUN_API === "true",
  };
}

export function isCloudflareAccessEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.CLOUDFLARE_ACCESS_ENABLED === "true";
}

export async function validateCloudflareAccessHeader(
  header: unknown,
  config: CloudflareAccessConfig,
  requiredKind: AccessSubjectKind,
): Promise<{ ok: true; identity: CloudflareAccessIdentity } | AccessFailure> {
  if (!config.enabled) {
    return { ok: false, status: 503, body: { error: "Cloudflare Access is not enabled" } };
  }

  const issuer = normalizeIssuer(config.issuer);
  const audience = config.audience;
  if (!issuer || !audience) {
    return { ok: false, status: 503, body: { error: "Cloudflare Access is not configured" } };
  }

  if (typeof header !== "string" || header.length === 0) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  let verified: { ok: true; payload: AccessJwtPayload } | AccessFailure;
  try {
    verified = await verifyAccessJwt(header, { ...config, issuer, audience }, config.fetcher ?? fetch);
  } catch {
    return { ok: false, status: 503, body: { error: "Cloudflare Access validation unavailable" } };
  }
  if (!verified.ok) return verified;

  const identity = identityFromPayload(verified.payload);
  if (requiredKind === "service" && identity.kind !== "service" && !config.allowHumanForService) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  if (requiredKind === "admin" && identity.kind !== "admin" && !config.allowServiceForAdmin) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  return { ok: true, identity };
}

export function logCloudflareAccessFailure(route: string, status: number): void {
  console.warn("Cloudflare Access authorization failed", { route, status });
}

export function resetCloudflareAccessJwksCache(): void {
  jwksCache.clear();
}

async function verifyAccessJwt(
  token: string,
  config: CloudflareAccessConfig & { issuer: string; audience: string },
  fetcher: typeof fetch,
): Promise<{ ok: true; payload: AccessJwtPayload } | AccessFailure> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, status: 401, body: { error: "Unauthorized" } };

  const header = parseBase64UrlJson<JwtHeader>(parts[0]);
  const payload = parseBase64UrlJson<AccessJwtPayload>(parts[1]);
  if (!header || !payload || header.alg !== "RS256" || !header.kid) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  if (payload.iss !== config.issuer || payload.type !== "app") {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (!audiences.includes(config.audience)) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = bytesToArrayBuffer(base64UrlToBytes(parts[2]));
  const key = await findJwk(config, header.kid, fetcher);
  if (!key) return { ok: false, status: 401, body: { error: "Unauthorized" } };

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, signingInput);
  if (!valid) return { ok: false, status: 401, body: { error: "Unauthorized" } };

  return { ok: true, payload };
}

async function findJwk(config: CloudflareAccessConfig & { issuer: string }, kid: string, fetcher: typeof fetch): Promise<JsonWebKey | undefined> {
  const certsUrl = config.certsUrl ?? `${config.issuer}/cdn-cgi/access/certs`;
  let jwks = await getJwks(certsUrl, fetcher, false);
  let key = jwks.keys?.find((candidate) => jwkKid(candidate) === kid);
  if (!key) {
    jwks = await getJwks(certsUrl, fetcher, true);
    key = jwks.keys?.find((candidate) => jwkKid(candidate) === kid);
  }
  return key;
}

async function getJwks(certsUrl: string, fetcher: typeof fetch, forceRefresh: boolean): Promise<Jwks> {
  const cached = jwksCache.get(certsUrl);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < jwksTtlMs) return cached.jwks;

  const response = await fetcher(certsUrl);
  if (!response.ok) throw new Error(`Cloudflare Access certs fetch failed: ${response.status}`);
  const jwks = (await response.json()) as Jwks;
  jwksCache.set(certsUrl, { fetchedAt: Date.now(), jwks });
  return jwks;
}

function cloudflareAccessConfig(env: Record<string, string | undefined>, audience?: string): CloudflareAccessConfig {
  return {
    enabled: isCloudflareAccessEnabled(env),
    issuer: normalizeIssuer(env.CLOUDFLARE_ACCESS_ISSUER),
    audience,
    certsUrl: env.CLOUDFLARE_ACCESS_CERTS_URL,
  };
}

function normalizeIssuer(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\/+$/, "");
}

function identityFromPayload(payload: AccessJwtPayload): CloudflareAccessIdentity {
  const audience = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  const serviceTokenId = payload.service_token_id ?? (payload.service_token_status ? payload.common_name : undefined);
  if (serviceTokenId) {
    return {
      kind: "service",
      serviceTokenId,
      audience,
      issuer: payload.iss ?? "",
    };
  }

  return {
    kind: "admin",
    email: payload.email,
    audience,
    issuer: payload.iss ?? "",
  };
}

function parseBase64UrlJson<T>(value: string): T | undefined {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
  } catch {
    return undefined;
  }
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  if (typeof atob === "function") {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function jwkKid(key: JsonWebKey): string | undefined {
  return (key as JsonWebKey & { kid?: string }).kid;
}
