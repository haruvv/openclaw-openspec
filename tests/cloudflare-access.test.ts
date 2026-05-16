import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetCloudflareAccessJwksCache,
  validateCloudflareAccessHeader,
} from "../src/security/cloudflare-access.js";

const issuer = "https://team.cloudflareaccess.com";
const audience = "admin-aud";

describe("validateCloudflareAccessHeader", () => {
  beforeEach(() => {
    resetCloudflareAccessJwksCache();
  });

  it("accepts a valid admin Access JWT", async () => {
    const key = await createSigningKey("key-1");
    const token = await signJwt(key, { email: "admin@example.com", aud: [audience], iss: issuer });
    const fetcher = jwksFetcher([key.publicJwk]);

    await expect(validateCloudflareAccessHeader(token, config(fetcher), "admin")).resolves.toMatchObject({
      ok: true,
      identity: { kind: "admin", email: "admin@example.com" },
    });
  });

  it("rejects a token with the wrong audience", async () => {
    const key = await createSigningKey("key-1");
    const token = await signJwt(key, { email: "admin@example.com", aud: ["other-aud"], iss: issuer });

    await expect(validateCloudflareAccessHeader(token, config(jwksFetcher([key.publicJwk])), "admin")).resolves.toEqual({
      ok: false,
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("rejects expired tokens", async () => {
    const key = await createSigningKey("key-1");
    const token = await signJwt(key, {
      email: "admin@example.com",
      aud: [audience],
      iss: issuer,
      exp: Math.floor(Date.now() / 1000) - 1,
    });

    await expect(validateCloudflareAccessHeader(token, config(jwksFetcher([key.publicJwk])), "admin")).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("rejects invalid signatures", async () => {
    const goodKey = await createSigningKey("key-1");
    const badKey = await createSigningKey("key-1");
    const token = await signJwt(badKey, { email: "admin@example.com", aud: [audience], iss: issuer });

    await expect(validateCloudflareAccessHeader(token, config(jwksFetcher([goodKey.publicJwk])), "admin")).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("refreshes JWKs when the token kid is not in cache", async () => {
    const oldKey = await createSigningKey("old");
    const newKey = await createSigningKey("new");
    const token = await signJwt(newKey, { email: "admin@example.com", aud: [audience], iss: issuer });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ keys: [oldKey.publicJwk] }))
      .mockResolvedValueOnce(jsonResponse({ keys: [oldKey.publicJwk, newKey.publicJwk] }));

    await expect(validateCloudflareAccessHeader(token, config(fetcher), "admin")).resolves.toMatchObject({
      ok: true,
      identity: { kind: "admin" },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("distinguishes service token Access JWTs from admin sessions", async () => {
    const key = await createSigningKey("key-1");
    const token = await signJwt(key, {
      aud: [audience],
      iss: issuer,
      common_name: "service-token.access",
      service_token_status: true,
    });
    const fetcher = jwksFetcher([key.publicJwk]);

    await expect(validateCloudflareAccessHeader(token, config(fetcher), "service")).resolves.toMatchObject({
      ok: true,
      identity: { kind: "service", serviceTokenId: "service-token.access" },
    });
    await expect(validateCloudflareAccessHeader(token, config(fetcher), "admin")).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });
});

function config(fetcher: typeof fetch) {
  return {
    enabled: true,
    issuer,
    audience,
    certsUrl: `${issuer}/cdn-cgi/access/certs`,
    fetcher,
  };
}

function jwksFetcher(keys: JsonWebKey[]): typeof fetch {
  return vi.fn(async () => jsonResponse({ keys })) as unknown as typeof fetch;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function createSigningKey(kid: string) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  return { kid, privateKey: keyPair.privateKey, publicJwk };
}

async function signJwt(
  key: { kid: string; privateKey: CryptoKey },
  payload: Record<string, unknown>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", kid: key.kid, typ: "JWT" });
  const body = base64UrlJson({
    type: "app",
    iat: now,
    nbf: now - 1,
    exp: now + 300,
    ...payload,
  });
  const signingInput = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`;
}

function base64UrlJson(value: unknown): string {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}
