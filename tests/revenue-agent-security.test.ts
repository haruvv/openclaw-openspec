import { describe, expect, it } from "vitest";
import { sanitizeSecretText, validateSafeTargetUrl } from "../src/revenue-agent/security.js";

describe("validateSafeTargetUrl", () => {
  it("rejects hostnames that resolve to private addresses", async () => {
    const result = await validateSafeTargetUrl("https://internal.example", {
      dnsLookup: async () => [{ address: "10.0.0.10", family: 4 }],
    });

    expect(result).toEqual({ ok: false, error: "url host resolves to a disallowed address" });
  });

  it("accepts hostnames that resolve to public addresses", async () => {
    const result = await validateSafeTargetUrl("https://public.example/path", {
      dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }],
    });

    expect(result).toEqual({ ok: true, url: "https://public.example/path" });
  });
});

describe("sanitizeSecretText", () => {
  it("redacts configured secrets and bearer tokens", () => {
    const sanitized = sanitizeSecretText("failed with secret-value and Bearer abc.def", {
      REVENUE_AGENT_INTEGRATION_TOKEN: "secret-value",
    });

    expect(sanitized).toBe("failed with [REDACTED] and Bearer [REDACTED]");
  });
});
