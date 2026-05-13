import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { resetRevenueAgentRateLimit } from "../src/revenue-agent/security.js";

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
    resetRevenueAgentRateLimit();
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

function mockHttp(input: { auth?: string; body: unknown }): { req: Request; res: Response } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const req = {
    headers: input.auth ? { authorization: input.auth } : {},
    body: input.body,
  } as Request;
  return { req, res };
}
