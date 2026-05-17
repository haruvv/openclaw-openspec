// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../admin-ui/src/App";
import { apiCache } from "../admin-ui/src/api";
import { DiscoverySettingsPanel, SalesOperationSettingsPanel } from "../admin-ui/src/components/settings";
import type { AgentRun, AgentRunDetail, DiscoverySettings } from "../admin-ui/src/types";

describe("admin UI routing", () => {
  afterEach(() => {
    apiCache.clear();
    vi.unstubAllGlobals();
  });

  it("renders a run detail page from a route param", async () => {
    vi.stubGlobal("fetch", createRunDetailFetch());

    render(
      <MemoryRouter initialEntries={["/admin/seo-sales/runs/run-1"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "実行詳細" })).toBeInTheDocument();
    expect(await screen.findByText("https://example.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "調査結果" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "営業評価" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "営業提案書" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "営業アクション" })).toBeInTheDocument();
    expect(screen.getByText(/CTA改善/)).toBeInTheDocument();
    expect(await screen.findByText("AI営業承認案")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "承認して営業メール送信" })).toBeInTheDocument();
    expect(screen.getByText("50,000円")).toBeInTheDocument();
    expect(screen.getByText("ホームページの簡易診断について")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "info@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.com/contact" })).toBeInTheDocument();
    expect(screen.getByText("ページタイトル")).toBeInTheDocument();
    expect(screen.getByText(/検索結果やブラウザタブ/)).toBeInTheDocument();
    expect(screen.queryByText("Document lacks title")).not.toBeInTheDocument();
    expect(screen.queryByText("Title element is missing.")).not.toBeInTheDocument();
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
    vi.stubGlobal("fetch", createRunDetailFetch());

    render(
      <MemoryRouter initialEntries={["/admin/seo-sales/runs/run-1?url=https%3A%2F%2Fexample.com%2F"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: "このURLの実行ログへ戻る" })).toHaveAttribute("href", "/admin/seo-sales/runs?url=https%3A%2F%2Fexample.com%2F");
    expect(screen.queryByRole("link", { name: "URL詳細へ戻る" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "再実行" })).not.toBeInTheDocument();
  });

  it("starts a URL-level rerun from the filtered run list", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (init?.method === "POST") {
        expect(path).toBe("/api/admin/seo-sales/runs");
        expect(JSON.parse(String(init.body))).toEqual({ url: "https://example.com/" });
        return createJsonResponse({ runId: "run-new", location: "/admin/seo-sales/runs/run-new" });
      }
      if (path === "/api/admin/seo-sales/runs/run-new") {
        return createJsonResponse({ run: createRunDetail({ id: "run-new" }) });
      }
      if (path === "/api/admin/seo-sales/runs/run-new/outreach-draft") {
        return createJsonResponse(createDraftResponse("run-new"));
      }
      if (path === "/api/admin/seo-sales/settings") {
        return createJsonResponse(createSettingsResponse());
      }
      return createJsonResponse({
        runs: [createRun({ id: "run-1", summary: { targetUrl: "https://example.com/", seoScore: 90 } })],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/admin/seo-sales/runs?url=https%3A%2F%2Fexample.com%2F"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "このURLを再解析" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/seo-sales/runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://example.com/" }),
      }),
    ));
    expect(await screen.findByRole("link", { name: "このURLの実行ログへ戻る" })).toHaveAttribute("href", "/admin/seo-sales/runs?url=https%3A%2F%2Fexample.com%2F");
  });

  it("shows an empty sales assessment state for older run details", async () => {
    vi.stubGlobal("fetch", createRunDetailFetch(createRunDetail({ withAudit: false })));

    render(
      <MemoryRouter initialEntries={["/admin/seo-sales/runs/run-1"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "営業評価" })).toBeInTheDocument();
    expect(screen.getByText("営業評価はまだ生成されていません")).toBeInTheDocument();
  });

  it("sends reviewed outreach from the run detail sales panel", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/admin/seo-sales/runs/run-1/outreach/send" && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toMatchObject({
          recipientEmail: "info@example.com",
          subject: "ホームページの簡易診断について",
        });
        return createJsonResponse({
          salesActions: {
            outreachMessages: [{
              id: "msg-1",
              runId: "run-1",
              targetUrl: "https://example.com",
              domain: "example.com",
              recipientEmail: "info@example.com",
              subject: "ホームページの簡易診断について",
              bodyText: "確認した範囲で気になった点がありました。必要でしたら共有します。",
              status: "sent",
              sentAt: "2026-05-15T10:00:02.000Z",
              metadata: {},
              createdAt: "2026-05-15T10:00:02.000Z",
              updatedAt: "2026-05-15T10:00:02.000Z",
            }],
            paymentLinks: [],
          },
        });
      }
      return createRunDetailFetch()(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/admin/seo-sales/runs/run-1"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "承認して営業メール送信" }));

    expect(await screen.findByText(/info@example.com \/ sent/)).toBeInTheDocument();
  });

  it("renders stock trading dashboard empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse(createStockOverviewResponse())));

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "株自動売買" })).toBeInTheDocument();
    expect(await screen.findByText("Paper-only")).toBeInTheDocument();
    expect(screen.getByText("Webhook ready")).toBeInTheDocument();
    expect(screen.getByText("内部ペーパー資産はまだありません")).toBeInTheDocument();
    expect(screen.getByText("内部ペーパー建玉はまだありません")).toBeInTheDocument();
    expect(screen.getByText("AI候補銘柄はまだありません")).toBeInTheDocument();
    expect(screen.getByText("リサーチ材料はまだありません")).toBeInTheDocument();
    expect(screen.getByText("市場シグナルはまだありません")).toBeInTheDocument();
    expect(screen.getByText("AI判断はまだありません")).toBeInTheDocument();
    expect(screen.getByText("内部ペーパー取引はまだありません")).toBeInTheDocument();
    expect(screen.getByText("戦略成績はまだありません")).toBeInTheDocument();
    expect(screen.getByText("バックテストはまだありません")).toBeInTheDocument();
    expect(screen.getByText("学習ログはまだありません")).toBeInTheDocument();
    expect(screen.getByText("再利用ルールはまだありません")).toBeInTheDocument();
    expect(screen.getByText("価格データ収集履歴はまだありません")).toBeInTheDocument();
  });

  it("renders stock trading populated pages", async () => {
    vi.stubGlobal("fetch", createStockFetch());

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/decisions/decision-1"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("NVDA / WATCH")).toBeInTheDocument();
    expect(screen.getByText("AI投資会議")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("risk")).toBeInTheDocument();
    expect(screen.getByText("knowledge-curator")).toBeInTheDocument();
    expect(screen.getByText("リスク過大")).toBeInTheDocument();
    expect(screen.getByText("判断に使った学習ログ")).toBeInTheDocument();
    expect(screen.getByText("初回押しを待つ")).toBeInTheDocument();
    expect(screen.getByText("ブレイク直後に飛び乗らない。")).toBeInTheDocument();
  });

  it("triggers exit reviews from open positions", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/admin/stock-trading/positions/NVDA/exit-review") {
        return createJsonResponse({ result: { decision: createStockDecision() } });
      }
      return createJsonResponse(createStockOverviewResponse({
        portfolio: {
          initialCapital: 1000000,
          currentEquity: 1000200,
          cashBalance: 999000,
          realizedPnl: 0,
          unrealizedPnl: 200,
          winRate: null,
          maximumDrawdown: null,
          positions: [createStockPosition()],
          history: [],
        },
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("NVDA")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit確認" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/stock-trading/positions/NVDA/exit-review", expect.objectContaining({ method: "POST" })));
  });

  it("renders stock research page and creates manual context", async () => {
    const fetchMock = createStockFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/research"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("AI需要が強い")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("銘柄"), { target: { value: "nvda" } });
    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "好決算" } });
    fireEvent.change(screen.getByLabelText("要約"), { target: { value: "売上と利益が市場予想を上回った。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/stock-trading/research", expect.objectContaining({ method: "POST" })));
  });

  it("renders stock candidates page and manages candidates", async () => {
    const fetchMock = createStockFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/candidates"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("NVDA")).toBeInTheDocument();
    expect(screen.getByText("Market Scanner: 出来高急増")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "承認" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/stock-trading/candidates/candidate-1", expect.objectContaining({ method: "PATCH" })));
    fireEvent.click(screen.getByRole("button", { name: "AI投資会議へ" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/stock-trading/candidates/candidate-1/convert", expect.objectContaining({ method: "POST" })));
  });

  it("renders stock rulebook page and activates a rule", async () => {
    const fetchMock = createStockFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/rules"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Knowledge Rulebook")).toBeInTheDocument();
    expect(await screen.findByText("初回押しを待つ")).toBeInTheDocument();
    expect(screen.getByText("ブレイク直後に飛び乗らない。")).toBeInTheDocument();
    expect(screen.getByText("候補")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "採用" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/stock-trading/rules/stock-rule-lesson-1",
      expect.objectContaining({ method: "PATCH" }),
    ));
  });

  it("renders stock market data page and runs collection", async () => {
    const fetchMock = createStockFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/market-data"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Watchlist")).toBeInTheDocument();
    expect(screen.getByText("NVDA")).toBeInTheDocument();
    expect(screen.getByText("Collection Runs")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "候補抽出" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/stock-trading/market-data/scan",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByText(/候補 1件/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "収集実行" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/stock-trading/market-data/collect",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("renders stock strategy performance page", async () => {
    vi.stubGlobal("fetch", createStockFetch());

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/strategies"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("breakout_momentum")).toBeInTheDocument();
    expect(screen.getByText("採用候補")).toBeInTheDocument();
    expect(screen.getByText("2.50")).toBeInTheDocument();
  });

  it("renders stock backtests page and runs a backtest", async () => {
    const fetchMock = createStockFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/backtests"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("バックテスト履歴")).toBeInTheDocument();
    expect(screen.getByText("breakout_momentum")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "バックテスト実行" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/stock-trading/backtests", expect.objectContaining({ method: "POST" })));
  });

  it("renders stock trading settings without secrets", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse({
      integrations: [
        { label: "moomoo OpenAPI", key: "MOOMOO_OPENAPI_HOST", configured: true, purpose: "market_data" },
        { label: "TradingView webhook", key: "TRADINGVIEW_WEBHOOK_SECRET", configured: false, purpose: "webhook" },
      ],
      runner: {
        enabled: true,
        mode: "paper_only",
        decisionMode: "auto",
        llmConfigured: true,
        confidenceThreshold: 0.7,
        paperTradeNotional: 100000,
        tradingViewWebhookConfigured: true,
        message: "内部ペーパー判断だけを記録します。",
      },
      tradingView: {
        webhookPath: "/webhooks/stock-trading/tradingview",
        secretHeader: "x-tradingview-secret",
        latestSignal: createStockSignal(),
      },
      safety: { mode: "paper_only", realOrderPlacementEnabled: false, message: "内部ペーパー取引のみ" },
    })));

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/settings"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("moomoo OpenAPI")).toBeInTheDocument();
    expect(screen.getByText("TradingView webhook")).toBeInTheDocument();
    expect(screen.getByText("TradingView Webhook設定")).toBeInTheDocument();
    expect(screen.getByText(/\/webhooks\/stock-trading\/tradingview/)).toBeInTheDocument();
    expect(screen.getAllByText(/x-tradingview-secret/).length).toBeGreaterThan(0);
    expect(screen.getByText(/"symbol": "{{ticker}}"/)).toBeInTheDocument();
    expect(screen.getByText("NVDA / 5m")).toBeInTheDocument();
    expect(screen.queryByText("tradingview-secret")).not.toBeInTheDocument();
  });
});

describe("DiscoverySettingsPanel", () => {
  afterEach(() => {
    apiCache.clear();
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

describe("SalesOperationSettingsPanel", () => {
  afterEach(() => {
    apiCache.clear();
    vi.unstubAllGlobals();
  });

  it("submits sales operation settings", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        defaultPaymentAmountJpy: 88000,
        outreachCooldownDays: 45,
        contactDiscoveryMaxPages: 8,
        sendgridFromName: "Revenue Agent",
      });
      return createJsonResponse({
        sales: {
          defaultPaymentAmountJpy: 88000,
          outreachCooldownDays: 45,
          contactDiscoveryMaxPages: 8,
          sendgridFromName: "Revenue Agent",
          configuredFromAdmin: true,
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SalesOperationSettingsPanel settings={createSalesSettings()} />);

    fireEvent.change(screen.getByLabelText("デフォルト金額（JPY）"), { target: { value: "88000" } });
    fireEvent.change(screen.getByLabelText("再送クールダウン（日）"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("連絡先探索ページ数"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("送信者名"), { target: { value: "Revenue Agent" } });
    expect(screen.getByText("未保存の変更があります。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "設定を保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("保存しました")).toBeInTheDocument();
  });
});

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function createRunDetailFetch(run = createRunDetail()) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.endsWith("/outreach-draft")) return createJsonResponse(createDraftResponse(run.id));
    if (path === "/api/admin/seo-sales/settings") return createJsonResponse(createSettingsResponse());
    return createJsonResponse({ run });
  });
}

function createStockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/api/admin/stock-trading/decisions/decision-1") {
      return createJsonResponse({ decision: createStockDecisionDetail() });
    }
    if (path === "/api/admin/stock-trading/decisions") {
      return createJsonResponse({ decisions: [createStockDecision()] });
    }
    if (path === "/api/admin/stock-trading/candidates") {
      if (init?.method === "PATCH") return createJsonResponse({ candidate: { ...createStockCandidate(), status: "approved" } });
      return createJsonResponse({ candidates: [createStockCandidate()] });
    }
    if (path === "/api/admin/stock-trading/candidates/candidate-1") {
      return createJsonResponse({ candidate: { ...createStockCandidate(), status: "approved" } });
    }
    if (path === "/api/admin/stock-trading/candidates/candidate-1/convert") {
      return createJsonResponse({ candidate: { ...createStockCandidate(), status: "converted_to_decision", convertedDecisionId: "decision-1" }, result: { decision: createStockDecision() } });
    }
    if (path === "/api/admin/stock-trading/trades") {
      return createJsonResponse({ trades: [createStockTrade()] });
    }
    if (path === "/api/admin/stock-trading/strategies") {
      return createJsonResponse({ strategies: [createStockStrategyPerformance()] });
    }
    if (path === "/api/admin/stock-trading/candles") {
      return createJsonResponse({ candles: [] });
    }
    if (path === "/api/admin/stock-trading/backtests") {
      if (init?.method === "POST") return createJsonResponse({ run: createStockBacktestRun() });
      return createJsonResponse({ runs: [createStockBacktestRun()] });
    }
    if (path === "/api/admin/stock-trading/signals") {
      return createJsonResponse({ signals: [createStockSignal()] });
    }
    if (path === "/api/admin/stock-trading/research") {
      if (init?.method === "POST") return createJsonResponse({ item: createStockResearch() });
      return createJsonResponse({ research: [createStockResearch()] });
    }
    if (path === "/api/admin/stock-trading/lessons") {
      return createJsonResponse({ lessons: [createStockLesson()] });
    }
    if (path === "/api/admin/stock-trading/rules") {
      return createJsonResponse({ rules: [createStockRule()] });
    }
    if (path === "/api/admin/stock-trading/rules/stock-rule-lesson-1") {
      return createJsonResponse({ rule: { ...createStockRule(), status: "active" } });
    }
    if (path === "/api/admin/stock-trading/market-data/watchlist") {
      if (init?.method === "POST") return createJsonResponse({ entry: createStockMarketDataWatchlistEntry() });
      return createJsonResponse({ entries: [createStockMarketDataWatchlistEntry()] });
    }
    if (path === "/api/admin/stock-trading/market-data/watchlist/watchlist-1") {
      return createJsonResponse({ entry: { ...createStockMarketDataWatchlistEntry(), enabled: false } });
    }
    if (path === "/api/admin/stock-trading/market-data/runs") {
      return createJsonResponse({ runs: [createStockMarketDataRun()] });
    }
    if (path === "/api/admin/stock-trading/market-data/collect") {
      return createJsonResponse({ run: createStockMarketDataRun() });
    }
    if (path === "/api/admin/stock-trading/market-data/scan") {
      return createJsonResponse({ scannedEntries: 1, createdCandidates: 1, skippedEntries: 0, candidates: [createStockCandidate()] });
    }
    return createJsonResponse(createStockOverviewResponse({
      recentSignals: [createStockSignal()],
      recentCandidates: [createStockCandidate()],
      recentDecisions: [createStockDecision()],
      recentTrades: [createStockTrade()],
      strategyPerformance: [createStockStrategyPerformance()],
      recentBacktests: [createStockBacktestRun()],
      recentLessons: [createStockLesson()],
      recentRules: [createStockRule()],
      marketDataWatchlist: [createStockMarketDataWatchlistEntry()],
      recentMarketDataRuns: [createStockMarketDataRun()],
      recentResearch: [createStockResearch()],
    }));
  });
}

function createStockOverviewResponse(overrides: Record<string, unknown> = {}) {
  return {
    portfolio: {
      initialCapital: 1000000,
      currentEquity: 1000000,
      cashBalance: 1000000,
      realizedPnl: 0,
      unrealizedPnl: 0,
      winRate: null,
      maximumDrawdown: null,
      positions: [],
      history: [],
    },
    recentDecisions: [],
    recentCandidates: [],
    recentTrades: [],
    recentLessons: [],
    recentRules: [],
    recentSignals: [],
    recentResearch: [],
    strategyPerformance: [],
    recentBacktests: [],
    marketDataWatchlist: [],
    recentMarketDataRuns: [],
    integrations: [{ label: "moomoo OpenAPI", key: "MOOMOO_OPENAPI_HOST", configured: false, purpose: "market_data" }],
    runner: {
      enabled: true,
      mode: "paper_only",
      decisionMode: "auto",
      llmConfigured: true,
      confidenceThreshold: 0.7,
      paperTradeNotional: 100000,
      tradingViewWebhookConfigured: true,
      message: "内部ペーパー判断だけを記録します。",
    },
    safety: { mode: "paper_only", realOrderPlacementEnabled: false, message: "内部ペーパー取引のみ" },
    ...overrides,
  };
}

function createStockPosition() {
  return {
    id: "position-1",
    symbol: "NVDA",
    quantity: 10,
    averageEntryPrice: 128,
    realizedPnl: 0,
    lastMarkPrice: 130,
    lastMarkedAt: "2026-05-17T01:00:00.000Z",
    marketValue: 1300,
    unrealizedPnl: 20,
    openedAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T01:00:00.000Z",
  };
}

function createStockResearch() {
  return {
    id: "research-1",
    symbol: "NVDA",
    category: "news",
    title: "AI需要が強い",
    summary: "半導体需要に関する手入力メモ。",
    source: "manual",
    sentiment: "positive",
    importance: 0.8,
    rawPayload: {},
    publishedAt: "2026-05-17T00:15:00.000Z",
    createdAt: "2026-05-17T00:16:00.000Z",
  };
}

function createStockCandidate() {
  return {
    id: "candidate-1",
    symbol: "NVDA",
    theme: "AI半導体",
    sector: "semiconductor",
    strategyTag: "breakout_momentum",
    reason: "Market Scanner: 出来高急増",
    score: 0.82,
    source: "tradingview",
    status: "watch",
    sourceRefId: "signal-1",
    rawPayload: { price: 128 },
    lastScannedAt: "2026-05-17T00:30:00.000Z",
    createdAt: "2026-05-17T00:30:00.000Z",
    updatedAt: "2026-05-17T00:30:00.000Z",
  };
}

function createStockSignal() {
  return {
    id: "signal-1",
    source: "tradingview",
    sourceSignalId: "alert-1",
    symbol: "NVDA",
    timeframe: "5m",
    price: 128,
    strategyTag: "breakout_momentum",
    suggestedAction: "BUY",
    indicators: { rsi: 58 },
    rawPayload: { symbol: "NVDA" },
    status: "executed",
    decisionId: "decision-1",
    tradeId: "trade-1",
    statusReason: "paper_execution_created",
    receivedAt: "2026-05-17T00:30:00.000Z",
  };
}

function createStockDecision() {
  return {
    id: "decision-1",
    symbol: "NVDA",
    finalAction: "WATCH",
    confidence: 0.72,
    strategyTag: "breakout_momentum",
    reasoning: "押し目形成まで待つ。",
    riskFactors: ["急騰後"],
    takeProfitPrice: 132,
    stopLossPrice: 124,
    createdAt: "2026-05-17T00:00:00.000Z",
  };
}

function createStockDecisionDetail() {
  const agentNames = ["market-scanner", "fundamental", "news", "technical", "entry", "exit", "risk", "portfolio", "review-learning", "knowledge-curator", "judge"];
  return {
    ...createStockDecision(),
    agents: agentNames.map((agentName) => ({
      id: `agent-${agentName}`,
      aiDecisionId: "decision-1",
      agentName,
      score: agentName === "risk" ? 35 : 60,
      stance: agentName === "risk" ? "reject" : "observe",
      summary: agentName === "risk" ? "リスク過大" : `${agentName} summary`,
      reasoning: agentName === "risk" ? "想定利益に対して損切り幅が広い。" : `${agentName} reasoning`,
      createdAt: "2026-05-17T00:00:00.000Z",
    })),
    learningItems: [createStockLesson()],
  };
}

function createStockTrade() {
  return {
    id: "trade-1",
    decisionId: "decision-1",
    symbol: "NVDA",
    side: "buy",
    quantity: 10,
    price: 128,
    executedAt: "2026-05-17T01:00:00.000Z",
    executionSource: "paper",
    rawExecution: {},
    realizedPnl: 240,
    outcome: "win",
    createdAt: "2026-05-17T01:00:00.000Z",
  };
}

function createStockStrategyPerformance() {
  return {
    strategyTag: "breakout_momentum",
    status: "adopt",
    tradeCount: 8,
    winCount: 5,
    lossCount: 3,
    flatCount: 0,
    winRate: 0.625,
    realizedPnl: 1200,
    grossProfit: 2400,
    grossLoss: -1200,
    averageProfit: 480,
    averageLoss: -400,
    expectancy: 150,
    profitFactor: 2.5,
    bestTradePnl: 900,
    worstTradePnl: -600,
    latestTradeAt: "2026-05-17T01:00:00.000Z",
  };
}

function createStockBacktestRun() {
  return {
    id: "backtest-1",
    symbol: "NVDA",
    timeframe: "1d",
    strategyTag: "breakout_momentum",
    params: { lookbackBars: 3 },
    status: "completed",
    candleCount: 6,
    tradeCount: 1,
    winRate: 1,
    realizedPnl: 5800,
    grossProfit: 5800,
    grossLoss: 0,
    averageProfit: 5800,
    averageLoss: null,
    expectancy: 5800,
    profitFactor: null,
    maximumDrawdown: 0,
    from: "2026-05-01T00:00:00.000Z",
    to: "2026-05-06T00:00:00.000Z",
    startedAt: "2026-05-17T01:00:00.000Z",
    completedAt: "2026-05-17T01:00:00.000Z",
    createdAt: "2026-05-17T01:00:00.000Z",
  };
}

function createStockLesson() {
  return {
    id: "lesson-1",
    sourceTradeId: "trade-1",
    category: "rule_candidate",
    title: "初回押しを待つ",
    body: "ブレイク直後に飛び乗らない。",
    confidence: 0.68,
    appliedToSkill: false,
    createdAt: "2026-05-17T03:00:00.000Z",
  };
}

function createStockRule() {
  return {
    id: "stock-rule-lesson-1",
    sourceLearningItemId: "lesson-1",
    category: "entry",
    title: "初回押しを待つ",
    ruleText: "ブレイク直後に飛び乗らない。",
    status: "candidate",
    confidence: 0.68,
    createdAt: "2026-05-17T03:00:00.000Z",
    updatedAt: "2026-05-17T03:00:00.000Z",
  };
}

function createStockMarketDataWatchlistEntry() {
  return {
    id: "watchlist-1",
    symbol: "NVDA",
    timeframe: "1d",
    provider: "moomoo",
    enabled: true,
    lookbackLimit: 200,
    notes: "AI半導体",
    lastCollectedAt: "2026-05-17T04:00:00.000Z",
    createdAt: "2026-05-17T03:30:00.000Z",
    updatedAt: "2026-05-17T04:00:00.000Z",
  };
}

function createStockMarketDataRun() {
  return {
    id: "market-data-run-1",
    provider: "moomoo",
    status: "completed",
    requestedEntries: 1,
    completedEntries: 1,
    upsertedCandles: 2,
    startedAt: "2026-05-17T04:00:00.000Z",
    completedAt: "2026-05-17T04:00:02.000Z",
    createdAt: "2026-05-17T04:00:00.000Z",
  };
}

function createSettingsResponse() {
  return {
    integrations: [
      { label: "SendGrid", key: "SENDGRID_API_KEY", configured: true },
      { label: "Stripe", key: "STRIPE_SECRET_KEY", configured: true },
    ],
    policies: [
      { key: "sendEmail", label: "メール送信", enabled: true },
      { key: "sendTelegram", label: "Telegram通知", enabled: false },
      { key: "createPaymentLink", label: "決済リンク作成", enabled: true },
    ],
    discovery: createDiscoverySettings(),
    sales: createSalesSettings(),
  };
}

function createDraftResponse(runId: string) {
  return {
    draft: {
      runId,
      targetUrl: "https://example.com",
      domain: "example.com",
      recipientEmail: "info@example.com",
      contactMethods: [
        {
          type: "email",
          value: "info@example.com",
          sourceUrl: "https://example.com/contact",
          confidence: "high",
          label: "mailto",
        },
        {
          type: "form",
          value: "https://example.com/contact",
          sourceUrl: "https://example.com/contact",
          confidence: "high",
          label: "問い合わせフォーム",
        },
      ],
      subject: "ホームページの簡易診断について",
      bodyText: "確認した範囲で気になった点がありました。必要でしたら共有します。",
      source: "llm_revenue_audit",
      caveats: ["アクセス数は確認していません。"],
      approval: {
        priority: "medium",
        confidence: "high",
        recommendedAmountJpy: 50000,
        rationale: [
          "相談前に離脱している可能性があります。",
          "CTA改善: 検出された課題に合っています。",
        ],
        caveats: ["アクセス数は確認していません。"],
        recipientSource: "detected_email",
        readyToSend: true,
        nextStep: "承認すると営業メールだけを送信します。Payment Linkは返信や関心を確認してから別操作で作成します。",
      },
    },
    salesActions: { outreachMessages: [], paymentLinks: [] },
  };
}

function createRunDetail(options: { id?: string; withAudit?: boolean } = {}): AgentRunDetail {
  const llmRevenueAudit = options.withAudit === false ? undefined : {
    overallAssessment: "問い合わせ導線に改善余地があります。",
    salesPriority: "medium",
    confidence: "high",
    businessImpactSummary: "相談前に離脱している可能性があります。",
    recommendedOffer: {
      name: "CTA改善",
      description: "問い合わせ導線を整えます。",
      estimatedPriceRange: "3万〜5万円",
      reason: "検出された課題に合っています。",
    },
    prioritizedFindings: [{
      title: "問い合わせ導線が弱い",
      businessImpact: "相談機会を逃している可能性があります。",
      suggestedFix: "ファーストビューに相談CTAを追加します。",
      salesAngle: "無料診断の共有から会話を始めます。",
      confidence: "high",
    }],
    outreach: {
      subject: "ホームページの簡易診断について",
      firstEmail: "確認した範囲で気になった点がありました。必要でしたら共有します。",
      followUpEmail: "先日の簡易診断の件で、必要でしたら要点だけお送りします。",
    },
    caveats: ["アクセス数は確認していません。"],
  };
  return {
    id: options.id ?? "run-1",
    agentType: "seo",
    source: "manual",
    status: "passed",
    input: { url: "https://example.com" },
    summary: {
      targetUrl: "https://example.com",
      domain: "example.com",
      seoScore: 90,
      opportunityScore: 40,
      llmRevenueAudit,
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

function createSalesSettings() {
  return {
    defaultPaymentAmountJpy: 50000,
    outreachCooldownDays: 30,
    contactDiscoveryMaxPages: 5,
    sendgridFromName: "RevenueAgentPlatform",
    configuredFromAdmin: true,
  };
}
