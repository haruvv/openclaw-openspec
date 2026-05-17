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
    expect(fetch).toHaveBeenCalledWith("/admin/api/seo-sales/runs/run-1", { credentials: "same-origin" });
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
        expect(path).toBe("/admin/api/seo-sales/runs");
        expect(JSON.parse(String(init.body))).toEqual({ url: "https://example.com/" });
        return createJsonResponse({ runId: "run-new", location: "/admin/seo-sales/runs/run-new" });
      }
      if (path === "/admin/api/seo-sales/runs/run-new") {
        return createJsonResponse({ run: createRunDetail({ id: "run-new" }) });
      }
      if (path === "/admin/api/seo-sales/runs/run-new/outreach-draft") {
        return createJsonResponse(createDraftResponse("run-new"));
      }
      if (path === "/admin/api/seo-sales/settings") {
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
      "/admin/api/seo-sales/runs",
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
      if (path === "/admin/api/seo-sales/runs/run-1/outreach/send" && init?.method === "POST") {
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
    expect(screen.getByText("内部ペーパー資産はまだありません")).toBeInTheDocument();
    expect(screen.getByText("AI判断はまだありません")).toBeInTheDocument();
    expect(screen.getByText("内部ペーパー取引はまだありません")).toBeInTheDocument();
    expect(screen.getByText("学習ログはまだありません")).toBeInTheDocument();
  });

  it("renders stock trading populated pages", async () => {
    vi.stubGlobal("fetch", createStockFetch());

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/decisions/decision-1"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("NVDA / WATCH")).toBeInTheDocument();
    expect(screen.getByText("risk")).toBeInTheDocument();
    expect(screen.getByText("リスク過大")).toBeInTheDocument();
  });

  it("renders stock trading settings without secrets", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => createJsonResponse({
      integrations: [
        { label: "moomoo OpenAPI", key: "MOOMOO_OPENAPI_HOST", configured: true, purpose: "market_data" },
        { label: "TradingView webhook", key: "TRADINGVIEW_WEBHOOK_SECRET", configured: false, purpose: "webhook" },
      ],
      safety: { mode: "paper_only", realOrderPlacementEnabled: false, message: "内部ペーパー取引のみ" },
    })));

    render(
      <MemoryRouter initialEntries={["/admin/stock-trading/settings"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("moomoo OpenAPI")).toBeInTheDocument();
    expect(screen.getByText("TradingView webhook")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
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
    if (path === "/admin/api/seo-sales/settings") return createJsonResponse(createSettingsResponse());
    return createJsonResponse({ run });
  });
}

function createStockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/admin/api/stock-trading/decisions/decision-1") {
      return createJsonResponse({ decision: createStockDecisionDetail() });
    }
    if (path === "/admin/api/stock-trading/decisions") {
      return createJsonResponse({ decisions: [createStockDecision()] });
    }
    if (path === "/admin/api/stock-trading/trades") {
      return createJsonResponse({ trades: [createStockTrade()] });
    }
    if (path === "/admin/api/stock-trading/lessons") {
      return createJsonResponse({ lessons: [createStockLesson()] });
    }
    return createJsonResponse(createStockOverviewResponse({
      recentDecisions: [createStockDecision()],
      recentTrades: [createStockTrade()],
      recentLessons: [createStockLesson()],
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
      history: [],
    },
    recentDecisions: [],
    recentTrades: [],
    recentLessons: [],
    integrations: [{ label: "moomoo OpenAPI", key: "MOOMOO_OPENAPI_HOST", configured: false, purpose: "market_data" }],
    safety: { mode: "paper_only", realOrderPlacementEnabled: false, message: "内部ペーパー取引のみ" },
    ...overrides,
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
  return {
    ...createStockDecision(),
    agents: [{
      id: "agent-risk-1",
      aiDecisionId: "decision-1",
      agentName: "risk",
      score: 35,
      stance: "reject",
      summary: "リスク過大",
      reasoning: "想定利益に対して損切り幅が広い。",
      createdAt: "2026-05-17T00:00:00.000Z",
    }],
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
