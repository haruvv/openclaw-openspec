import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverCompliantEmailMethods, hasSalesProhibition } from "../src/contact-discovery/compliant-email-discovery.js";
import { addContactSuppression } from "../src/contact-discovery/suppression.js";
import { resetDb } from "../src/utils/db.js";

describe("compliant email discovery", () => {
  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), "email-discovery-"));
    process.env.DB_PATH = join(dir, "pipeline.db");
    resetDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.HUNTER_API_KEY;
    delete process.env.HUNTER_API_BASE_URL;
    delete process.env.APOLLO_API_KEY;
    delete process.env.APOLLO_API_BASE_URL;
  });

  it("accepts relevant corporate Hunter emails and rejects personal domains", async () => {
    process.env.HUNTER_API_KEY = "hunter-key";
    process.env.HUNTER_API_BASE_URL = "https://hunter.test/domain-search";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      data: {
        accept_all: false,
        emails: [
          {
            value: "info@example.com",
            type: "generic",
            confidence: 96,
            verification: { status: "valid" },
            sources: [{ uri: "https://example.com/contact" }],
          },
          {
            value: "owner@gmail.com",
            type: "generic",
            confidence: 99,
            verification: { status: "valid" },
          },
        ],
      },
    }))));

    const result = await discoverCompliantEmailMethods({ domain: "example.com", sourceUrl: "https://example.com/" });

    expect(result.methods).toEqual([
      expect.objectContaining({
        type: "email",
        value: "info@example.com",
        confidence: "high",
        sourceUrl: "https://example.com/contact",
        metadata: expect.objectContaining({ provider: "hunter", verificationStatus: "valid" }),
      }),
    ]);
    expect(result.rejected).toContainEqual({ provider: "hunter", email: "owner@gmail.com", reason: "personal_email_domain" });
  });

  it("keeps accept-all or unverified provider emails low priority", async () => {
    process.env.HUNTER_API_KEY = "hunter-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      data: {
        accept_all: true,
        emails: [{
          value: "marketing@example.com",
          type: "generic",
          confidence: 80,
          verification: { status: "accept_all" },
        }],
      },
    }))));

    const result = await discoverCompliantEmailMethods({ domain: "example.com", sourceUrl: "https://example.com/" });

    expect(result.methods[0]).toMatchObject({
      value: "marketing@example.com",
      confidence: "low",
    });
    expect(result.methods[0].reason).toContain("low_priority_provider_candidate");
  });

  it("uses Apollo fallback only for relevant corporate roles", async () => {
    process.env.APOLLO_API_KEY = "apollo-key";
    process.env.APOLLO_API_BASE_URL = "https://apollo.test/search";
    const fetchMock = vi.fn(async (_url: URL | string, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ "x-api-key": "apollo-key" });
      return new Response(JSON.stringify({
        people: [
          { email: "ceo@example.com", email_status: "verified", title: "CEO", first_name: "A" },
          { email: "engineer@example.com", email_status: "verified", title: "Backend Engineer" },
        ],
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverCompliantEmailMethods({ domain: "example.com", sourceUrl: "https://example.com/" });

    expect(result.methods.map((method) => method.value)).toEqual(["ceo@example.com"]);
    expect(result.rejected).toContainEqual({ provider: "apollo", email: "engineer@example.com", reason: "low_role_relevance" });
  });

  it("filters suppressed contacts", async () => {
    process.env.HUNTER_API_KEY = "hunter-key";
    await addContactSuppression({ kind: "email", value: "info@example.com", reason: "opt_out", source: "test" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      data: {
        emails: [{ value: "info@example.com", type: "generic", confidence: 90, verification: { status: "valid" } }],
      },
    }))));

    const result = await discoverCompliantEmailMethods({ domain: "example.com", sourceUrl: "https://example.com/" });

    expect(result.methods).toHaveLength(0);
    expect(result.rejected).toContainEqual({ provider: "hunter", email: "info@example.com", reason: "suppressed_email" });
  });

  it("detects sales-prohibited content", async () => {
    expect(hasSalesProhibition("<p>営業目的のご連絡は固くお断りします。</p>")).toBe(true);
    expect(await discoverCompliantEmailMethods({
      domain: "example.com",
      sourceUrl: "https://example.com/",
      html: "<p>No sales emails please.</p>",
    })).toMatchObject({ methods: [], salesProhibited: true });
  });
});
