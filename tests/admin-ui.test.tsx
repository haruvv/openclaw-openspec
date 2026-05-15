// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../admin-ui/src/App";
import { DiscoverySettingsPanel } from "../admin-ui/src/components/settings";
import type { AgentRunDetail, DiscoverySettings } from "../admin-ui/src/types";

describe("admin UI routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a run detail page from a route param", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse({
      run: createRunDetail(),
    })));

    render(
      <MemoryRouter initialEntries={["/admin/seo-sales/runs/run-1"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "実行詳細" })).toBeInTheDocument();
    expect(await screen.findByText("https://example.com")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/admin/seo-sales/runs/run-1", { credentials: "same-origin" });
  });
});

describe("DiscoverySettingsPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits a normalized discovery settings payload", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        queries: expect.stringContaining("税理士事務所 公式サイト"),
        seedUrls: "https://example.com",
        dailyQuota: 4,
        searchLimit: 6,
        country: "us",
        lang: "en",
        location: "",
      });
      return createJsonResponse({ discovery: createDiscoverySettings({ country: "us", lang: "en" }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DiscoverySettingsPanel settings={createDiscoverySettings()} />);

    expect(screen.getByRole("button", { name: "変更なし" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("固定候補URL（検証用）"), { target: { value: "https://example.com" } });
    fireEvent.change(screen.getByLabelText("1日の解析上限"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("検索件数/キーワード"), { target: { value: "6" } });
    fireEvent.click(screen.getByLabelText("英語サイト / 米国"));
    expect(screen.getByText("未保存の変更があります。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "設定を保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("保存しました")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "変更なし" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("固定候補URL（検証用）"), { target: { value: "https://changed.example.com" } });

    expect(screen.queryByText("保存しました")).not.toBeInTheDocument();
    expect(screen.getByText("未保存の変更があります。")).toBeInTheDocument();
  });
});

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function createRunDetail(): AgentRunDetail {
  return {
    id: "run-1",
    agentType: "seo",
    source: "manual",
    status: "passed",
    input: { url: "https://example.com" },
    summary: { targetUrl: "https://example.com", domain: "example.com", seoScore: 90, opportunityScore: 40 },
    startedAt: "2026-05-15T10:00:00.000Z",
    completedAt: "2026-05-15T10:00:01.000Z",
    steps: [],
    artifacts: [],
  };
}

function createDiscoverySettings(overrides: Partial<DiscoverySettings> = {}): DiscoverySettings {
  return {
    queries: ["税理士事務所 公式サイト"],
    seedUrls: [],
    dailyQuota: 2,
    searchLimit: 3,
    country: "jp",
    lang: "ja",
    location: "",
    configuredFromAdmin: true,
    ...overrides,
  };
}
