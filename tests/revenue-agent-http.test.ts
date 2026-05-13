import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

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
    mockRunRevenueAgent.mockResolvedValue({
      id: "run-1",
      targetUrl: "https://example.com",
      startedAt: "2026-05-13T00:00:00.000Z",
      completedAt: "2026-05-13T00:00:01.000Z",
      status: "passed",
      steps: [],
      outputs: { proposalPath: "output/proposals/example.com.md", seoScore: 80 },
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("rejects missing bearer token without running the pipeline", async () => {
    const { req, res } = mockHttp({ body: { url: "https://example.com" } });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mockRunRevenueAgent).not.toHaveBeenCalled();
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

  it("runs with dry-run defaults", async () => {
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: { url: "https://example.com" },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "passed", outputs: { proposalPath: "output/proposals/example.com.md", seoScore: 80 } })
    );
    expect(mockRunRevenueAgent).toHaveBeenCalledWith({
      targetUrl: "https://example.com",
      sendEmail: false,
      sendTelegram: false,
      createPaymentLink: false,
    });
  });

  it("propagates explicit side-effect flags", async () => {
    const { req, res } = mockHttp({
      auth: "Bearer integration-test",
      body: {
        url: "https://example.com",
        sendEmail: true,
        sendTelegram: true,
        createPaymentLink: true,
      },
    });

    await handleRevenueAgentRun(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockRunRevenueAgent).toHaveBeenCalledWith({
      targetUrl: "https://example.com",
      sendEmail: true,
      sendTelegram: true,
      createPaymentLink: true,
    });
  });
});

function mockHttp(input: { auth?: string; body: unknown }): { req: Request; res: Response } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const req = {
    headers: input.auth ? { authorization: input.auth } : {},
    body: input.body,
  } as Request;
  return { req, res };
}
