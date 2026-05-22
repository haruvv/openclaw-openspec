import { describe, expect, it, vi, beforeEach } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { measureSeo } from "../src/site-crawler/lighthouse-runner.js";

describe("measureSeo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.LIGHTHOUSE_TIMEOUT_MS;
    delete process.env.LIGHTHOUSE_MAX_BUFFER_BYTES;
  });

  it("runs Lighthouse with a hard process timeout", async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(null, JSON.stringify({
        categories: { seo: { score: 0.8 } },
        audits: {
          "document-title": { id: "document-title", title: "Document title", score: 1, description: "" },
        },
      }), "");
    });

    const result = await measureSeo("https://example.com");

    expect(result).toMatchObject({ ok: true });
    expect(execFileMock).toHaveBeenCalledWith(
      "npx",
      expect.arrayContaining(["lighthouse", "https://example.com"]),
      expect.objectContaining({
        timeout: 90_000,
        killSignal: "SIGKILL",
      }),
      expect.any(Function),
    );
  });

  it("classifies killed Lighthouse processes as retryable timeouts", async () => {
    const error = Object.assign(new Error("Command failed"), {
      killed: true,
      signal: "SIGKILL",
      stderr: "still loading",
    });
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(error, "", "still loading");
    });

    const result = await measureSeo("https://slow.example");

    expect(result).toMatchObject({
      ok: false,
      failure: {
        reason: "timeout",
        retryable: true,
        signal: "SIGKILL",
      },
    });
    if (!result.ok) {
      expect(result.failure.message).toContain("Lighthouse timeout after 90000ms");
      expect(result.failure.stderrExcerpt).toContain("still loading");
    }
  });
});
