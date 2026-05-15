import { describe, expect, it, vi } from "vitest";
import { isAdminUiPath, maybeServeAdminUiAsset } from "../worker/admin-assets.js";

describe("worker admin UI assets", () => {
  it("identifies admin frontend paths", () => {
    expect(isAdminUiPath("/admin")).toBe(true);
    expect(isAdminUiPath("/admin/seo-sales/settings")).toBe(true);
    expect(isAdminUiPath("/api/admin/apps")).toBe(false);
  });

  it("serves concrete admin assets from the asset binding", async () => {
    const assets = createAssetBinding({
      "/admin/assets/index.js": new Response("console.log('ok')", {
        headers: { "content-type": "application/javascript" },
      }),
    });

    const response = await maybeServeAdminUiAsset(
      new Request("https://example.com/admin/assets/index.js"),
      { ASSETS: assets },
    );

    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toBe("console.log('ok')");
    expect(assets.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back admin SPA routes to /admin/index.html", async () => {
    const assets = createAssetBinding({
      "/admin/index.html": new Response("<div id=\"root\"></div>", {
        headers: { "content-type": "text/html" },
      }),
    });

    const response = await maybeServeAdminUiAsset(
      new Request("https://example.com/admin/seo-sales/settings", {
        headers: { accept: "text/html" },
      }),
      { ASSETS: assets },
    );

    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toContain("root");
    expect(assets.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ url: "https://example.com/admin/index.html" }));
  });

  it("falls back nested admin SPA detail routes to /admin/index.html", async () => {
    const assets = createAssetBinding({
      "/admin/index.html": new Response("<div id=\"root\"></div>", {
        headers: { "content-type": "text/html" },
      }),
    });

    const response = await maybeServeAdminUiAsset(
      new Request("https://example.com/admin/seo-sales/runs/run-1", {
        headers: { accept: "text/html" },
      }),
      { ASSETS: assets },
    );

    expect(response?.status).toBe(200);
    expect(assets.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ url: "https://example.com/admin/index.html" }));
  });

  it("does not intercept admin API or non-idempotent admin requests", async () => {
    const assets = createAssetBinding({});

    await expect(maybeServeAdminUiAsset(new Request("https://example.com/api/admin/apps"), { ASSETS: assets })).resolves.toBeNull();
    await expect(maybeServeAdminUiAsset(new Request("https://example.com/admin/runs", { method: "POST" }), { ASSETS: assets })).resolves.toBeNull();
    expect(assets.fetch).not.toHaveBeenCalled();
  });
});

function createAssetBinding(files: Record<string, Response>) {
  return {
    fetch: vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      return files[path]?.clone() ?? new Response("Not Found", { status: 404 });
    }),
  };
}
