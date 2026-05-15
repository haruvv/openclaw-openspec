import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalEnv = { ...process.env };

describe("sales repository", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    const dir = await mkdtemp(join(tmpdir(), "sales-repo-"));
    process.env = {
      ...originalEnv,
      DB_PATH: join(dir, "pipeline.db"),
      DURABLE_STORAGE_BASE_URL: "",
      DURABLE_STORAGE_TOKEN: "",
    };
  });

  it("stores outreach and payment link records in SQLite fallback", async () => {
    const { createAgentRun } = await import("../src/agent-runs/repository.js");
    const { createOutreachMessage, createPaymentLinkRecord, getSalesActionsForRun, hasRecentSentOutreach } = await import("../src/sales/repository.js");
    await createAgentRun({
      id: "run-1",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://example.com/" },
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
    });

    await createOutreachMessage({
      runId: "run-1",
      targetUrl: "https://example.com/",
      domain: "example.com",
      recipientEmail: "info@example.com",
      subject: "確認",
      bodyText: "本文",
      status: "sent",
      reviewedAt: new Date("2026-05-14T00:00:00.000Z"),
      sentAt: new Date("2026-05-14T00:00:01.000Z"),
    });
    await createPaymentLinkRecord({
      runId: "run-1",
      domain: "example.com",
      recipientEmail: "info@example.com",
      amountJpy: 30000,
      stripePaymentLinkId: "plink_test",
      paymentLinkUrl: "https://buy.stripe.com/test",
      status: "created",
      expiresAt: new Date("2026-06-14T00:00:00.000Z"),
    });

    await expect(hasRecentSentOutreach("example.com", 30)).resolves.toBe(true);
    await expect(getSalesActionsForRun("run-1")).resolves.toMatchObject({
      outreachMessages: [{ recipientEmail: "info@example.com", status: "sent" }],
      paymentLinks: [{ amountJpy: 30000, paymentLinkUrl: "https://buy.stripe.com/test" }],
    });
  });

  it("uses durable HTTP storage when configured", async () => {
    process.env = {
      ...process.env,
      DURABLE_STORAGE_BASE_URL: "https://storage.example",
      DURABLE_STORAGE_TOKEN: "secret",
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ results: [{ results: [] }] }));
    vi.stubGlobal("fetch", fetchMock);
    const { createOutreachMessage } = await import("../src/sales/repository.js");

    await createOutreachMessage({
      runId: "run-1",
      targetUrl: "https://example.com/",
      domain: "example.com",
      recipientEmail: "info@example.com",
      subject: "確認",
      bodyText: "本文",
      status: "sent",
      sentAt: new Date("2026-05-14T00:00:01.000Z"),
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toBe("https://storage.example/internal/storage/sql");
    expect(requestInit?.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(String(requestInit?.body)).toContain("sales_outreach_messages");
  });
});
