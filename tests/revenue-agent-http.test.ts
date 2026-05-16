import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { resetRevenueAgentRateLimit } from "../src/revenue-agent/security.js";
import { resetCloudflareAccessJwksCache } from "../src/security/cloudflare-access.js";

const { mockRunRevenueAgent } = vi.hoisted(() => ({
  mockRunRevenueAgent: vi.fn(),
}));

vi.mock("../src/revenue-agent/runner.js", () => ({
  runRevenueAgent: mockRunRevenueAgent,
}));

import { handleRevenueAgentRun } from "../src/revenue-agent/http.js";

const originalEnv = { ...process.env };

describe("handleRevenueAgentRun", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.REVENUE_AGENT_INTEGRATION_TOKEN = "integration-test";
    process.env.REVENUE_AGENT_RATE_LIMIT_PER_MINUTE = "60";
    delete process.env.REVENUE_AGENT_ALLOW_EMAIL;
    delete process.env.REVENUE_AGENT_ALLOW_TELEGRAM;
    delete process.env.REVENUE_AGENT_ALLOW_PAYMENT_LINK;
    delete process.env.CLOUDFLARE_ACCESS_ENABLED;
    delete process.env.CLOUDFLARE_ACCESS_ISSUER;
    delete process.env.CLOUDFLARE_ACCESS_MACHINE_AUD;
    delete process.env.CLOUDFLARE_ACCESS_CERTS_URL;
    resetRevenueAgentRateLimit();
    resetCloudflareAccessJwksCache();
    mockRunRevenueAgent.mockResolvedValue({
      id: "run-1",
      targetUrl: "https://93.184.216.34",
      startedAt: "2026-05-13T00:00:00.000Z",
      completedAt: "2026-05-13T00:00:01.000Z",
      status: "passed",
      steps: [],
      outputs: { proposalPath: "output/proposals/example.com.md", seoScore: 80 },
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetRevenueAgentRateLimit();
    resetCloudflareAccessJwksCache();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("rejects missing bearer token without running the pipeline", async () => {
    const { req, res } = mockHttp({ body: { url: "https://93.184.216.34" } });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mockRunRevenueAgent).not.toHaveBeenCalled();
  });

  it("rejects invalid bearer token without revealing server token configuration", async () => {
    const { req, res } = mockHttp({
      auth: "Bearer wrong-token",
      body: { url: "https://93.184.216.34" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mockRunRevenueAgent).not.toHaveBeenCalled();
  });

  it("returns unavailable when the server token is not configured", async () => {
    delete process.env.REVENUE_AGENT_INTEGRATION_TOKEN;
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: { url: "https://93.184.216.34" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "Service unavailable" });
    expect(mockRunRevenueAgent).not.toHaveBeenCalled();
  });

  it("rejects missing Cloudflare Access service assertions when Access is enabled", async () => {
    enableMachineAccess([]);
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: { url: "https://93.184.216.34" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mockRunRevenueAgent).not.toHaveBeenCalled();
  });

  it("rejects invalid Cloudflare Access service assertions", async () => {
    const key = await createSigningKey("key-1");
    enableMachineAccess([key.publicJwk]);
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      accessJwt: "not-a-jwt",
      body: { url: "https://93.184.216.34" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockRunRevenueAgent).not.toHaveBeenCalled();
  });

  it("still rejects invalid bearer tokens when the Access service assertion is valid", async () => {
    const key = await createSigningKey("key-1");
    enableMachineAccess([key.publicJwk]);
    const accessJwt = await signServiceJwt(key);
    const { req, res } = mockHttp({
      auth: "Bearer wrong-token",
      accessJwt,
      body: { url: "https://93.184.216.34" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mockRunRevenueAgent).not.toHaveBeenCalled();
  });

  it("runs when both Access service assertion and bearer token are valid", async () => {
    const key = await createSigningKey("key-1");
    enableMachineAccess([key.publicJwk]);
    const accessJwt = await signServiceJwt(key);
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      accessJwt,
      body: { url: "https://93.184.216.34" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockRunRevenueAgent).toHaveBeenCalledTimes(1);
  });

  it("rate limits before running the pipeline", async () => {
    process.env.REVENUE_AGENT_RATE_LIMIT_PER_MINUTE = "1";
    const first = mockHttp({
      auth: "Bearer integration-test",
      body: { url: "https://93.184.216.34" },
    });
    const second = mockHttp({
      auth: "Bearer integration-test",
      body: { url: "https://93.184.216.34" },
    });

    await handleRevenueAgentRun(first.req, first.res);
    await handleRevenueAgentRun(second.req, second.res);

    expect(first.res.status).toHaveBeenCalledWith(200);
    expect(second.res.status).toHaveBeenCalledWith(429);
    expect(second.res.json).toHaveBeenCalledWith({ error: "Too many requests" });
    expect(mockRunRevenueAgent).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid URLs before running the pipeline", async () => {
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: { url: "not-a-url" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "url must be a valid URL" });
    expect(mockRunRevenueAgent).not.toHaveBeenCalled();
  });

  it.each([
    ["unsupported scheme", "file:///etc/passwd", "url must be http or https"],
    ["localhost", "http://localhost:3000", "url host is not allowed"],
    ["loopback IP", "http://127.0.0.1", "url host is not allowed"],
    ["private IP", "http://10.0.0.1", "url host is not allowed"],
    ["metadata IP", "http://169.254.169.254", "url host is not allowed"],
  ])("rejects unsafe URL: %s", async (_name, url, error) => {
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: { url },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error });
    expect(mockRunRevenueAgent).not.toHaveBeenCalled();
  });

  it("runs with dry-run defaults", async () => {
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: { url: "https://93.184.216.34" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "passed", outputs: { proposalPath: "output/proposals/example.com.md", seoScore: 80 } })
    );
    expect(mockRunRevenueAgent).toHaveBeenCalledWith({
      targetUrl: "https://93.184.216.34",
      source: "api",
      sendEmail: false,
      sendTelegram: false,
      createPaymentLink: false,
      sideEffectSkipReasons: {
        sendEmail: undefined,
        sendTelegram: undefined,
        createPaymentLink: undefined,
      },
    });
  });

  it("does not enable side effects unless server policy allows them", async () => {
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: {
        url: "https://93.184.216.34",
        sendEmail: true,
        sendTelegram: true,
        createPaymentLink: true,
      },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockRunRevenueAgent).toHaveBeenCalledWith({
      targetUrl: "https://93.184.216.34",
      source: "api",
      sendEmail: false,
      sendTelegram: false,
      createPaymentLink: false,
      sideEffectSkipReasons: {
        sendEmail: "email side effects are disabled by server policy",
        sendTelegram: "Telegram side effects are disabled by server policy",
        createPaymentLink: "payment-link side effects are disabled by server policy",
      },
    });
  });

  it("propagates explicit side-effect flags when server policy allows them", async () => {
    process.env.REVENUE_AGENT_ALLOW_EMAIL = "true";
    process.env.REVENUE_AGENT_ALLOW_TELEGRAM = "true";
    process.env.REVENUE_AGENT_ALLOW_PAYMENT_LINK = "true";
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: {
        url: "https://93.184.216.34",
        sendEmail: true,
        sendTelegram: true,
        createPaymentLink: true,
      },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockRunRevenueAgent).toHaveBeenCalledWith({
      targetUrl: "https://93.184.216.34",
      source: "api",
      sendEmail: true,
      sendTelegram: true,
      createPaymentLink: true,
      sideEffectSkipReasons: {
        sendEmail: undefined,
        sendTelegram: undefined,
        createPaymentLink: undefined,
      },
    });
  });

  it("sanitizes configured secrets in step errors", async () => {
    process.env.SENDGRID_API_KEY = "sendgrid-secret";
    mockRunRevenueAgent.mockResolvedValue({
      id: "run-1",
      targetUrl: "https://93.184.216.34",
      startedAt: "2026-05-13T00:00:00.000Z",
      completedAt: "2026-05-13T00:00:01.000Z",
      status: "failed",
      steps: [{ name: "sendgrid_email", status: "failed", durationMs: 1, error: "bad sendgrid-secret" }],
      outputs: {},
    });
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: { url: "https://93.184.216.34" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [expect.objectContaining({ error: "bad [REDACTED]" })],
      })
    );
  });
});

function mockHttp(input: { auth?: string; accessJwt?: string; body: unknown }): { req: Request; res: Response } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const headers: Record<string, string> = {};
  if (input.auth) headers.authorization = input.auth;
  if (input.accessJwt) headers["cf-access-jwt-assertion"] = input.accessJwt;
  const req = {
    headers,
    body: input.body,
  } as Request;
  return { req, res };
}

function enableMachineAccess(keys: JsonWebKey[]) {
  process.env.CLOUDFLARE_ACCESS_ENABLED = "true";
  process.env.CLOUDFLARE_ACCESS_ISSUER = "https://team.cloudflareaccess.com";
  process.env.CLOUDFLARE_ACCESS_MACHINE_AUD = "machine-aud";
  process.env.CLOUDFLARE_ACCESS_CERTS_URL = "https://team.cloudflareaccess.com/cdn-cgi/access/certs";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })));
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

async function signServiceJwt(key: { kid: string; privateKey: CryptoKey }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", kid: key.kid, typ: "JWT" });
  const body = base64UrlJson({
    type: "app",
    iss: "https://team.cloudflareaccess.com",
    aud: ["machine-aud"],
    iat: now,
    nbf: now - 1,
    exp: now + 300,
    service_token_status: true,
    common_name: "openclaw.access",
  });
  const signingInput = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
