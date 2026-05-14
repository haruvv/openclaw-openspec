import { describe, expect, it, vi } from "vitest";
import { DurableHttpStorageClient } from "../src/storage/durable-http.js";

describe("durable HTTP storage client", () => {
  it("sends authenticated SQL batches to the Worker bridge", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ results: [{ success: true }] }),
    );
    const client = new DurableHttpStorageClient({
      config: {
        baseUrl: "https://storage.example",
        token: "secret",
        artifactInlineByteThreshold: 16,
      },
      fetchImpl,
    });

    await expect(client.executeSql([{ sql: "SELECT 1", params: [] }])).resolves.toEqual([{ success: true }]);

    const [requestUrl, requestInit] = fetchImpl.mock.calls[0];
    expect(String(requestUrl)).toBe("https://storage.example/internal/storage/sql");
    expect(requestInit?.headers).toMatchObject({ Authorization: "Bearer secret" });
  });

  it("keeps small artifact bodies inline", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = new DurableHttpStorageClient({
      config: {
        baseUrl: "https://storage.example",
        token: "secret",
        artifactInlineByteThreshold: 32,
      },
      fetchImpl,
    });

    await expect(
      client.putArtifactBody({
        runId: "run-1",
        type: "proposal",
        label: "Proposal",
        contentText: "small",
        contentType: "text/markdown",
        createdAt: new Date("2026-05-14T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      storage: "inline",
      contentText: "small",
      byteSize: 5,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stores large artifact bodies through the Worker bridge", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ key: "ok", byteSize: 64 }));
    const client = new DurableHttpStorageClient({
      config: {
        baseUrl: "https://storage.example",
        token: "secret",
        artifactInlineByteThreshold: 4,
      },
      fetchImpl,
    });

    const result = await client.putArtifactBody({
      runId: "run-1",
      type: "proposal",
      label: "Example Proposal",
      contentText: "large body",
      contentType: "text/markdown",
      createdAt: new Date("2026-05-14T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      storage: "object",
      byteSize: 10,
      contentType: "text/markdown",
    });
    expect(result.storage === "object" ? result.objectKey : "").toMatch(/^agent-runs\/run-1\//);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
