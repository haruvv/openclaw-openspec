import { describe, expect, it, vi } from "vitest";
import { handleInternalStorage, handleStorageHealth } from "../worker/storage-bridge.js";

describe("worker storage bridge", () => {
  it("rejects missing storage tokens", async () => {
    const response = await handleInternalStorage(
      new Request("https://example.com/internal/storage/sql", { method: "POST" }),
      {},
      new URL("https://example.com/internal/storage/sql"),
      "secret",
    );

    expect(response.status).toBe(401);
  });

  it("executes authenticated D1 statement batches", async () => {
    const bound = { sql: "bound" };
    const bind = vi.fn(() => bound);
    const prepare = vi.fn(() => ({ bind }));
    const batch = vi.fn(async () => [{ results: [{ ok: 1 }], success: true }]);
    const env = {
      OPERATIONAL_DB: { prepare, batch },
    } as unknown as Parameters<typeof handleInternalStorage>[1];

    const response = await handleInternalStorage(
      new Request("https://example.com/internal/storage/sql", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
        body: JSON.stringify({ statements: [{ sql: "SELECT ?", params: [1] }] }),
      }),
      env,
      new URL("https://example.com/internal/storage/sql"),
      "secret",
    );

    expect(response.status).toBe(200);
    expect(prepare).toHaveBeenCalledWith("SELECT ?");
    expect(bind).toHaveBeenCalledWith(1);
    expect(batch).toHaveBeenCalledWith([bound]);
  });

  it("stores and retrieves R2 artifact bodies", async () => {
    const put = vi.fn(async () => undefined);
    const get = vi.fn(async () => ({
      httpMetadata: { contentType: "text/markdown" },
      text: async () => "# Proposal",
    }));
    const env = {
      OPERATIONAL_ARTIFACTS: { put, get },
    } as unknown as Parameters<typeof handleInternalStorage>[1];

    const putResponse = await handleInternalStorage(
      new Request("https://example.com/internal/storage/artifacts", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
        body: JSON.stringify({ key: "agent-runs/run-1/proposal", contentText: "# Proposal", contentType: "text/markdown" }),
      }),
      env,
      new URL("https://example.com/internal/storage/artifacts"),
      "secret",
    );
    expect(putResponse.status).toBe(200);
    expect(put).toHaveBeenCalledWith("agent-runs/run-1/proposal", "# Proposal", {
      httpMetadata: { contentType: "text/markdown" },
    });

    const getResponse = await handleInternalStorage(
      new Request("https://example.com/internal/storage/artifacts/agent-runs%2Frun-1%2Fproposal", {
        headers: { Authorization: "Bearer secret" },
      }),
      env,
      new URL("https://example.com/internal/storage/artifacts/agent-runs%2Frun-1%2Fproposal"),
      "secret",
    );
    expect(getResponse.status).toBe(200);
    await expect(getResponse.text()).resolves.toBe("# Proposal");
  });

  it("reports durable health when D1 and R2 bindings are configured", async () => {
    const env = {
      OPERATIONAL_DB: {
        prepare: vi.fn(() => ({ first: vi.fn(async () => ({ ok: 1 })) })),
      },
      OPERATIONAL_ARTIFACTS: {},
    } as unknown as Parameters<typeof handleStorageHealth>[0];

    const response = await handleStorageHealth(env);
    const body = await response.json() as { storage?: { mode?: string; d1Readable?: boolean } };

    expect(body.storage).toMatchObject({ mode: "durable-http", d1Readable: true });
  });
});
