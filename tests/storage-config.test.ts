import { describe, expect, it } from "vitest";
import { getStorageConfig } from "../src/storage/config.js";

describe("storage config", () => {
  it("uses SQLite mode when durable storage settings are absent", () => {
    const config = getStorageConfig({ DB_PATH: "/tmp/test.db" });

    expect(config).toEqual({
      mode: "sqlite",
      sqliteDbPath: "/tmp/test.db",
    });
  });

  it("uses durable HTTP mode when base URL and token are configured", () => {
    const config = getStorageConfig({
      DB_PATH: "/tmp/fallback.db",
      DURABLE_STORAGE_BASE_URL: "https://example.com",
      DURABLE_STORAGE_TOKEN: "secret",
      ARTIFACT_INLINE_BYTE_THRESHOLD: "4096",
    });

    expect(config).toEqual({
      mode: "durable-http",
      sqliteDbPath: "/tmp/fallback.db",
      durableHttp: {
        baseUrl: "https://example.com",
        token: "secret",
        artifactInlineByteThreshold: 4096,
      },
    });
  });
});
