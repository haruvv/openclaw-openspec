// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../admin-ui/src/App";
import { DiscoverySettingsPanel } from "../admin-ui/src/components/settings";
import type { AgentRun, AgentRunDetail, DiscoverySettings } from "../admin-ui/src/types";

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
    expect(screen.getByRole("heading", { name: "調査結果" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "営業提案書" })).toBeInTheDocument();
    expect(screen.getByText("Document lacks title")).toBeInTheDocument();
    expect(screen.getAllByText("メール提案文").length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith("/api/admin/seo-sales/runs/run-1", { credentials: "same-origin" });
  });

  it("filters the run list by URL query", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse({
      runs: [
        createRun({ id: "run-1", summary: { targetUrl: "https://example.com/", seoScore: 90 } }),
        createRun({ id: "run-2", summary: { targetUrl: "https://other.example.com/", seoScore: 70 } }),
      ],
    })));

    render(
      <MemoryRouter initialEntries={["/admin/seo-sales/runs?url=https%3A%2F%2Fexample.com%2F"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("URL一覧から対象URLで絞り込んでいます: https://example.com/")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "https://example.com/" })).toBeInTheDocument();
    expect(screen.queryByText("https://other.example.com/")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "すべてのログ" })).toHaveAttribute("href", "/admin/seo-sales/runs");
    expect(screen.queryByRole("link", { name: "URL詳細へ戻る" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.com/" })).toHaveAttribute("href", "/admin/seo-sales/runs/run-1?url=https%3A%2F%2Fexample.com%2F");
  });

  it("shows a filtered run-list return link on a run detail page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse({
      run: createRunDetail(),
    })));

    render(
      <MemoryRouter initialEntries={["/admin/seo-sales/runs/run-1?url=https%3A%2F%2Fexample.com%2F"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: "このURLの実行ログへ戻る" })).toHaveAttribute("href", "/admin/seo-sales/runs?url=https%3A%2F%2Fexample.com%2F");
    expect(screen.queryByRole("link", { name: "URL詳細へ戻る" })).not.toBeInTheDocument();
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
    summary: {
      targetUrl: "https://example.com",
      domain: "example.com",
      seoScore: 90,
      opportunityScore: 40,
      opportunityFindings: [{
        category: "content",
        severity: "high",
        title: "主要ページの訴求が弱い",
        evidence: "サービス内容の説明が短く、問い合わせへの導線も目立たない",
        recommendation: "対象顧客ごとの課題と解決策を追記する",
        scoreImpact: 18,
      }],
      diagnostics: [{ id: "document-title", title: "Document lacks title", score: 0, description: "Title element is missing." }],
    },
    startedAt: "2026-05-15T10:00:00.000Z",
    completedAt: "2026-05-15T10:00:01.000Z",
    steps: [],
    artifacts: [{
      id: "artifact-1",
      type: "proposal",
      label: "example.com proposal",
      contentType: "text/markdown",
      contentText: "## 調査結果の要点\nSEOスコアは90点です。\n\n## メール提案文\nメール提案文\n\n## 提案の補足ポイント\n- 問い合わせ導線を改善する",
    }],
  };
}

function createRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "run-1",
    agentType: "seo",
    source: "manual",
    status: "passed",
    input: {},
    summary: { targetUrl: "https://example.com/", seoScore: 90 },
    startedAt: "2026-05-15T10:00:00.000Z",
    completedAt: "2026-05-15T10:00:01.000Z",
    ...overrides,
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
