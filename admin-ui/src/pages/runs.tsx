import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiCache, apiGet, apiPost } from "../api";
import { Empty, ErrorState, Info, Loading, Panel, StatusPill } from "../components/common";
import { FindingsList, ProposalViewer, RunsTable } from "../components/tables";
import { useApi } from "../hooks";
import type { AgentRun, AgentRunDetail, ContactMethod, LlmRevenueAudit, SalesActions, SalesOutreachDraft, SeoDiagnostic, SettingsPayload } from "../types";
import { formatDate, formatDuration, formatRevenueAuditConfidence, formatRevenueAuditPriority, formatSource, formatStepName, getLlmRevenueAudit, getOpportunityFindings, getOpportunityScore, getSeoDiagnostics, getSeoScore, getTargetUrl, urlsMatch } from "../utils";

export function RunsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useApi<{ runs: AgentRun[] }>("/api/admin/seo-sales/runs");
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("url") ?? "";
  const detailSearch = urlFilter ? `?url=${encodeURIComponent(urlFilter)}` : "";
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const runs = data?.runs ?? [];
  const visibleRuns = urlFilter ? runs.filter((run) => urlsMatch(getTargetUrl(run), urlFilter)) : runs;

  async function rerunUrl() {
    if (!urlFilter) return;
    setRerunning(true);
    setRerunError(null);
    try {
      const result = await apiPost<{ runId?: string; location?: string }>("/api/admin/seo-sales/runs", { url: urlFilter });
      apiCache.delete("/api/admin/seo-sales/runs");
      const detailPath = result.runId
        ? `/admin/seo-sales/runs/${encodeURIComponent(result.runId)}`
        : result.location;
      if (!detailPath) throw new Error("再解析の実行IDが返りませんでした");
      navigate(`${detailPath}?url=${encodeURIComponent(urlFilter)}`);
    } catch (err) {
      setRerunError(err instanceof Error ? err.message : "再解析の開始に失敗しました");
      setRerunning(false);
    }
  }

  return (
    <Panel
      title={urlFilter ? "このURLの実行ログ" : "実行ログ"}
      action={urlFilter ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={rerunUrl} className="btn-primary" disabled={rerunning}><RefreshCw className="h-4 w-4" />このURLを再解析</button>
          <Link to="/admin/seo-sales/runs" className="btn-secondary">すべてのログ</Link>
        </div>
      ) : null}
    >
      {urlFilter ? <p className="mb-3 break-words border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">URL一覧から対象URLで絞り込んでいます: {urlFilter}</p> : null}
      {rerunError ? <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{rerunError}</p> : null}
      {loading ? <Loading /> : error ? <ErrorState message={error} /> : <RunsTable runs={visibleRuns} detailSearch={detailSearch} />}
    </Panel>
  );
}

export function RunDetailPage() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("url") ?? "";
  const runListPath = urlFilter ? `/admin/seo-sales/runs?url=${encodeURIComponent(urlFilter)}` : "";
  const { data, loading, error, reload } = useApi<{ run: AgentRunDetail }>(`/api/admin/seo-sales/runs/${encodeURIComponent(id)}`);
  const isRunning = data?.run?.status === "running";
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => void reload(), 3000);
    return () => window.clearInterval(timer);
  }, [isRunning, reload]);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const run = data?.run;
  if (!run) return <Empty title="実行が見つかりません" />;
  const targetUrl = getTargetUrl(run);
  const seoScore = getSeoScore(run);
  const opportunityScore = getOpportunityScore(run);
  const opportunityFindings = getOpportunityFindings(run);
  const diagnostics = getSeoDiagnostics(run);
  const revenueAudit = getLlmRevenueAudit(run);
  const initialSalesActions = run.salesActions ?? { outreachMessages: [], paymentLinks: [] };
  const domain = typeof run.summary.domain === "string" ? run.summary.domain : "-";
  const proposalArtifacts = run.artifacts.filter((artifact) => artifact.type === "proposal");
  return (
    <div className="space-y-5">
      <Panel
        title={targetUrl}
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {runListPath ? <Link to={runListPath} className="btn-secondary">このURLの実行ログへ戻る</Link> : null}
          </div>
        )}
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Info label="状態" value={<StatusPill status={run.status} />} />
          <Info label="起点" value={formatSource(run.source)} />
          <Info label="開始" value={formatDate(run.startedAt)} />
          <Info label="所要時間" value={formatDuration(run.startedAt, run.completedAt)} />
        </div>
        {run.status === "running" ? (
          <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">実行中です。この詳細画面は3秒ごとに更新されます。</p>
        ) : null}
        {run.error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{run.error}</p> : null}
      </Panel>
      <Panel title="調査結果">
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Info label="ドメイン" value={domain} />
          <Info label="Lighthouse SEO" value={seoScore ?? "-"} />
          <Info label="改善余地スコア" value={opportunityScore ?? "-"} />
          <Info label="診断項目" value={`${diagnostics.length}件`} />
        </div>
        {opportunityFindings.length > 0 ? <FindingsList findings={opportunityFindings} /> : <Empty title="改善余地の詳細は記録されていません" />}
        {diagnostics.length > 0 ? <DiagnosticsTable diagnostics={diagnostics} /> : null}
      </Panel>
      <Panel title="営業評価">
        {revenueAudit ? <RevenueAuditView audit={revenueAudit} /> : <Empty title="営業評価はまだ生成されていません" description="既存の実行、またはLLM営業評価がスキップされた実行では、調査結果と営業提案書のみ表示されます。" />}
      </Panel>
      <Panel title="処理ステップ">
        {run.steps.length === 0 ? <Empty title="ステップ開始待ちです" description="サーバーが処理を開始すると、ここにステップ単位の進捗が表示されます。" /> : (
          <table className="data-table">
            <thead><tr><th>状態</th><th>名前</th><th>所要時間</th><th>理由 / エラー</th></tr></thead>
            <tbody>{run.steps.map((step) => <tr key={step.id}><td><StatusPill status={step.status} /></td><td>{formatStepName(step.name)}</td><td>{step.status === "running" ? "処理中" : `${step.durationMs} ms`}</td><td>{step.error ?? step.reason ?? ""}</td></tr>)}</tbody>
          </table>
        )}
      </Panel>
      <Panel title="営業提案書">
        {proposalArtifacts.length === 0 ? <Empty title="営業提案書はまだ生成されていません" description="調査結果をもとに、メールでどう提案するかをまとめた提案書がここに表示されます。" /> : proposalArtifacts.map((artifact) => (
          <ProposalViewer
            key={artifact.id}
            title={artifact.label}
            pathOrUrl={artifact.pathOrUrl}
            contentText={artifact.contentText}
            createdAt={artifact.createdAt}
          />
        ))}
      </Panel>
      <SalesActionsPanel runId={run.id} initialSalesActions={initialSalesActions} />
    </div>
  );
}

function SalesActionsPanel({ runId, initialSalesActions }: { runId: string; initialSalesActions: SalesActions }) {
  const [draft, setDraft] = useState<SalesOutreachDraft | null>(null);
  const [salesActions, setSalesActions] = useState<SalesActions>(initialSalesActions);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [amountJpy, setAmountJpy] = useState("50000");
  const [sendPaymentEmail, setSendPaymentEmail] = useState(false);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingDraft(true);
    setError(null);
    setSettingsError(null);
    setSettings(null);
    void Promise.all([
      apiGet<{ draft: SalesOutreachDraft; salesActions: SalesActions }>(`/api/admin/seo-sales/runs/${encodeURIComponent(runId)}/outreach-draft`),
      apiGet<SettingsPayload>("/api/admin/seo-sales/settings").catch((err) => {
        if (active) setSettingsError(err instanceof Error ? err.message : "副作用設定を読み込めませんでした");
        return null;
      }),
    ])
      .then(([result, loadedSettings]) => {
        if (!active) return;
        setDraft(result.draft);
        setSalesActions(result.salesActions);
        setSettings(loadedSettings);
        setAmountJpy(String(result.draft.approval.recommendedAmountJpy || loadedSettings?.sales?.defaultPaymentAmountJpy || 50000));
        setRecipientEmail(result.draft.recipientEmail ?? "");
        setSubject(result.draft.subject);
        setBodyText(result.draft.bodyText);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "営業レビューを読み込めませんでした");
      })
      .finally(() => {
        if (active) setLoadingDraft(false);
      });
    return () => {
      active = false;
    };
  }, [runId]);

  async function refreshSalesActions() {
    const result = await apiGet<{ draft: SalesOutreachDraft; salesActions: SalesActions }>(`/api/admin/seo-sales/runs/${encodeURIComponent(runId)}/outreach-draft`);
    setSalesActions(result.salesActions);
  }

  async function sendOutreach() {
    if (!window.confirm("AI営業承認案の内容で営業メールを送信します。よろしいですか？")) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiPost<{ salesActions: SalesActions }>(`/api/admin/seo-sales/runs/${encodeURIComponent(runId)}/outreach/send`, {
        recipientEmail,
        subject,
        bodyText,
      });
      setSalesActions(result.salesActions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "営業メールを送信できませんでした");
      await refreshSalesActions().catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  async function createPaymentLink() {
    if (!window.confirm("Payment Linkを作成します。初回営業メールとは別の明示操作として実行されます。よろしいですか？")) return;
    setSaving(true);
    setError(null);
    try {
      const latestSent = salesActions.outreachMessages.find((message) => message.status === "sent");
      const result = await apiPost<{ salesActions: SalesActions }>(`/api/admin/seo-sales/runs/${encodeURIComponent(runId)}/payment-links`, {
        amountJpy: Number(amountJpy),
        recipientEmail: recipientEmail || latestSent?.recipientEmail,
        outreachMessageId: latestSent?.id,
        sendEmail: sendPaymentEmail,
      });
      setSalesActions(result.salesActions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment Linkを作成できませんでした");
      await refreshSalesActions().catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  const emailPolicyEnabled = Boolean(settings?.policies.find((policy) => policy.key === "sendEmail")?.enabled);
  const paymentPolicyEnabled = Boolean(settings?.policies.find((policy) => policy.key === "createPaymentLink")?.enabled);
  const sendGridConfigured = Boolean(settings?.integrations.find((integration) => integration.key === "SENDGRID_API_KEY")?.configured);
  const stripeConfigured = Boolean(settings?.integrations.find((integration) => integration.key === "STRIPE_SECRET_KEY")?.configured);
  const emailUnavailableReason = !settings ? "副作用設定を確認中です" : !emailPolicyEnabled ? "メール送信ポリシーが無効です" : !sendGridConfigured ? "SendGrid APIキーが未設定です" : null;
  const paymentUnavailableReason = !settings ? "副作用設定を確認中です" : !paymentPolicyEnabled ? "決済リンク作成ポリシーが無効です" : !stripeConfigured ? "Stripeシークレットキーが未設定です" : null;
  const amountIsValid = Number.isInteger(Number(amountJpy)) && Number(amountJpy) > 0;
  const canSend = Boolean(recipientEmail.trim() && subject.trim() && bodyText.trim()) && !saving && !emailUnavailableReason;
  const canCreatePayment = amountIsValid && !saving && !paymentUnavailableReason && (!sendPaymentEmail || !emailUnavailableReason);
  const latestSent = salesActions.outreachMessages.find((message) => message.status === "sent");

  return (
    <Panel title="営業アクション">
      {loadingDraft ? <Loading /> : draft ? (
        <div className="space-y-4">
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
          {settingsError ? <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">{settingsError}</p> : null}
          <div className="border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-black text-emerald-900">AI営業承認案</div>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{draft.approval.nextStep}</p>
              </div>
              <button type="button" className="btn-primary shrink-0" disabled={!canSend || Boolean(latestSent)} onClick={sendOutreach}>
                {latestSent ? "営業メール送信済み" : "承認して営業メール送信"}
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <Info label="営業優先度" value={formatRevenueAuditPriority(draft.approval.priority)} />
              <Info label="信頼度" value={formatRevenueAuditConfidence(draft.approval.confidence)} />
              <Info label="推奨金額" value={`${draft.approval.recommendedAmountJpy.toLocaleString("ja-JP")}円`} />
              <Info label="宛先状態" value={formatRecipientSource(draft.approval.recipientSource)} />
            </div>
            {draft.approval.rationale.length > 0 ? (
              <div className="mt-3">
                <div className="text-xs font-black text-emerald-900">判断理由</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold leading-6 text-slate-700">
                  {draft.approval.rationale.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </div>
            ) : null}
            {!draft.approval.readyToSend ? (
              <p className="mt-3 rounded-lg bg-white p-3 text-sm font-bold text-amber-800">宛先メールが未検出です。問い合わせフォームや会社概要を確認して宛先を入力してください。</p>
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              <ContactMethodsPanel methods={draft.contactMethods ?? []} onSelectEmail={setRecipientEmail} />
              <div>
                <label className="text-sm font-black text-slate-700" htmlFor="outreach-recipient">宛先メール</label>
                <input id="outreach-recipient" className="input mt-2 w-full" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="info@example.com" />
              </div>
              <div>
                <label className="text-sm font-black text-slate-700" htmlFor="outreach-subject">件名</label>
                <input id="outreach-subject" className="input mt-2 w-full" value={subject} onChange={(event) => setSubject(event.target.value)} />
              </div>
              <div>
                <label className="text-sm font-black text-slate-700" htmlFor="outreach-body">本文</label>
                <textarea id="outreach-body" className="textarea mt-2 min-h-56" value={bodyText} onChange={(event) => setBodyText(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" disabled={!canSend || Boolean(latestSent)} onClick={sendOutreach}>この内容で承認送信</button>
                {emailUnavailableReason ? <span className="self-center text-xs font-bold text-slate-500">{emailUnavailableReason}</span> : null}
              </div>
            </div>
            <div className="space-y-3">
              <Info label="ドラフト元" value={draft.source === "llm_revenue_audit" ? "営業評価" : "保守的な汎用文面"} />
              <Info label="対象URL" value={draft.targetUrl} />
              <Info label="ドメイン" value={draft.domain} />
              {draft.caveats.length > 0 ? (
                <div className="border border-amber-100 bg-amber-50 p-3">
                  <div className="text-xs font-black text-amber-800">注意事項</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">
                    {draft.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-black text-slate-800">Payment Link</div>
            <p className="mt-1 text-sm font-semibold text-slate-600">初回営業メールとは別の明示操作です。相手の関心を確認してから作成してください。</p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
              <div>
                <label className="text-sm font-black text-slate-700" htmlFor="payment-amount">金額（JPY）</label>
                <input id="payment-amount" className="input mt-2 w-40" type="number" min="1" step="1" value={amountJpy} onChange={(event) => setAmountJpy(event.target.value)} />
              </div>
              <label className="check-row">
                <input type="checkbox" checked={sendPaymentEmail} disabled={Boolean(emailUnavailableReason)} onChange={(event) => setSendPaymentEmail(event.target.checked)} />
                作成後に宛先へメール送付
              </label>
              <button type="button" className="btn-secondary" disabled={!canCreatePayment} onClick={createPaymentLink}>Payment Linkを作成</button>
              {paymentUnavailableReason ? <span className="text-xs font-bold text-slate-500">{paymentUnavailableReason}</span> : null}
            </div>
            {sendPaymentEmail && emailUnavailableReason ? <p className="mt-2 text-xs font-bold text-amber-800">{emailUnavailableReason}</p> : null}
          </div>

          <SalesActionHistory salesActions={salesActions} />
        </div>
      ) : (
        <Empty title="営業レビューを作成できません" description="完了した解析結果がない、または対象URLが記録されていません。" />
      )}
    </Panel>
  );
}

function ContactMethodsPanel({ methods, onSelectEmail }: { methods: ContactMethod[]; onSelectEmail: (email: string) => void }) {
  const emails = methods.filter((method) => method.type === "email");
  const forms = methods.filter((method) => method.type === "form" || method.type === "contact_page");
  const phones = methods.filter((method) => method.type === "phone");
  if (methods.length === 0) {
    return (
      <div className="border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-800">
        公開メールや問い合わせフォームは検出できませんでした。会社概要や問い合わせページを手動確認してください。
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-slate-50 p-3">
      <div className="text-sm font-black text-slate-800">連絡先候補</div>
      {emails.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {emails.map((method) => (
            <button
              key={`${method.type}-${method.value}-${method.sourceUrl}`}
              type="button"
              className="btn-secondary"
              onClick={() => onSelectEmail(method.value)}
              title={`${formatContactConfidence(method.confidence)} / ${method.sourceUrl}`}
            >
              {method.value}
            </button>
          ))}
        </div>
      ) : null}
      {forms.length > 0 ? (
        <div className="mt-3 space-y-1">
          <div className="text-xs font-black text-slate-500">問い合わせフォーム</div>
          {forms.map((method) => (
            <a key={`${method.type}-${method.value}`} className="table-link block break-all text-sm" href={method.value} target="_blank" rel="noreferrer">
              {method.value}
            </a>
          ))}
        </div>
      ) : null}
      {phones.length > 0 ? (
        <div className="mt-3 text-sm font-semibold text-slate-600">
          電話: {phones.map((method) => method.value).join(" / ")}
        </div>
      ) : null}
    </div>
  );
}

function SalesActionHistory({ salesActions }: { salesActions: SalesActions }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <div className="mb-2 text-sm font-black text-slate-800">送信履歴</div>
        {salesActions.outreachMessages.length === 0 ? <Empty title="送信履歴はまだありません" /> : (
          <div className="space-y-2">
            {salesActions.outreachMessages.map((message) => (
              <div key={message.id} className="border border-slate-200 bg-white p-3 text-sm">
                <div className="font-black text-slate-800">{message.subject}</div>
                <div className="mt-1 break-all text-xs font-semibold text-slate-500">{message.recipientEmail} / {message.status} / {formatDate(message.sentAt ?? message.createdAt)}</div>
                {message.error ? <div className="mt-2 text-xs font-bold text-red-700">{message.error}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="mb-2 text-sm font-black text-slate-800">Payment Link</div>
        {salesActions.paymentLinks.length === 0 ? <Empty title="Payment Linkはまだありません" /> : (
          <div className="space-y-2">
            {salesActions.paymentLinks.map((link) => (
              <div key={link.id} className="border border-slate-200 bg-white p-3 text-sm">
                <div className="font-black text-slate-800">{link.amountJpy.toLocaleString("ja-JP")}円 / {link.status}</div>
                {link.paymentLinkUrl ? <a className="table-link mt-1 block break-all" href={link.paymentLinkUrl} target="_blank" rel="noreferrer">{link.paymentLinkUrl}</a> : null}
                <div className="mt-1 text-xs font-semibold text-slate-500">期限: {formatDate(link.expiresAt)}</div>
                {link.error ? <div className="mt-2 text-xs font-bold text-red-700">{link.error}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatContactConfidence(value: ContactMethod["confidence"]): string {
  return { high: "高信頼", medium: "中信頼", low: "低信頼" }[value];
}

function formatRecipientSource(value: SalesOutreachDraft["approval"]["recipientSource"]): string {
  return value === "detected_email" ? "メール検出済み" : "手動入力が必要";
}

function RevenueAuditView({ audit }: { audit: LlmRevenueAudit }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Info label="営業優先度" value={formatRevenueAuditPriority(audit.salesPriority)} />
        <Info label="信頼度" value={formatRevenueAuditConfidence(audit.confidence)} />
        <Info label="推奨オファー" value={`${audit.recommendedOffer.name} / ${audit.recommendedOffer.estimatedPriceRange}`} />
      </div>
      <div className="border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-black text-slate-500">総評</div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.overallAssessment}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.businessImpactSummary}</p>
      </div>
      <div className="border border-slate-200 bg-white p-4">
        <div className="text-xs font-black text-slate-500">推奨理由</div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.recommendedOffer.description}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.recommendedOffer.reason}</p>
      </div>
      {audit.prioritizedFindings.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-black text-slate-500">優先指摘</div>
          {audit.prioritizedFindings.map((finding) => (
            <div key={`${finding.title}-${finding.salesAngle}`} className="border border-slate-200 bg-white p-3 text-sm">
              <div className="font-black text-slate-800">{finding.title}</div>
              <div className="mt-1 text-xs font-bold text-slate-500">信頼度: {formatRevenueAuditConfidence(finding.confidence)}</div>
              <p className="mt-2 font-semibold leading-6 text-slate-700">{finding.businessImpact}</p>
              <p className="mt-1 font-semibold leading-6 text-slate-700">{finding.suggestedFix}</p>
              <p className="mt-1 font-semibold leading-6 text-slate-700">営業角度: {finding.salesAngle}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="border border-blue-100 bg-blue-50 p-4">
        <div className="text-xs font-black text-blue-800">初回接触案</div>
        <div className="mt-2 text-sm font-black text-slate-900">{audit.outreach.subject}</div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.outreach.firstEmail}</p>
      </div>
      <div className="border border-slate-200 bg-white p-4">
        <div className="text-xs font-black text-slate-500">追撃文面案</div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{audit.outreach.followUpEmail}</p>
      </div>
      {audit.caveats.length > 0 ? (
        <div className="border border-amber-100 bg-amber-50 p-4">
          <div className="text-xs font-black text-amber-800">注意事項</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">
            {audit.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DiagnosticsTable({ diagnostics }: { diagnostics: SeoDiagnostic[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>診断項目</th><th>スコア</th><th>内容</th></tr></thead>
        <tbody>{diagnostics.map((diagnostic) => {
          const display = formatSeoDiagnostic(diagnostic);
          return (
            <tr key={diagnostic.id}>
              <td>{display.title}</td>
              <td>{diagnostic.score === null ? "未計測" : `${Math.round(diagnostic.score * 100)}点`}</td>
              <td>{display.description}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function formatSeoDiagnostic(diagnostic: SeoDiagnostic): { title: string; description: string } {
  const known = SEO_DIAGNOSTIC_COPY[diagnostic.id];
  if (known) return known;
  return {
    title: `Lighthouse診断: ${diagnostic.id}`,
    description: diagnostic.score === null
      ? "この項目はLighthouseで計測できませんでした。"
      : "Lighthouseでこの項目に改善余地が検出されました。詳細な原文は保存データに保持されています。",
  };
}

const SEO_DIAGNOSTIC_COPY: Record<string, { title: string; description: string }> = {
  "document-title": {
    title: "ページタイトル",
    description: "検索結果やブラウザタブに表示されるtitle要素に改善余地があります。ページ内容と提供価値が伝わるタイトルにします。",
  },
  "meta-description": {
    title: "メタディスクリプション",
    description: "検索結果の説明文として使われるmeta descriptionに改善余地があります。対象顧客、提供価値、問い合わせ導線を含めます。",
  },
  "http-status-code": {
    title: "HTTPステータス",
    description: "ページが正常なHTTPステータスで返っていない可能性があります。検索エンジンがページを取得できる状態にします。",
  },
  "link-text": {
    title: "リンク文言",
    description: "リンクの文言だけでは遷移先の内容が分かりにくい可能性があります。具体的なページ名や行動が伝わる文言にします。",
  },
  "crawlable-anchors": {
    title: "クロール可能なリンク",
    description: "検索エンジンがたどりにくいリンクがあります。通常のhrefを持つリンクとして実装します。",
  },
  "is-crawlable": {
    title: "クロール許可",
    description: "検索エンジンがページをクロールできない設定になっている可能性があります。robots設定やmeta robotsを確認します。",
  },
  "robots-txt": {
    title: "robots.txt",
    description: "robots.txtの設定により、検索エンジンの巡回に影響が出ている可能性があります。",
  },
  "image-alt": {
    title: "画像の代替テキスト",
    description: "画像に代替テキストが不足しています。画像の意味や内容が伝わるalt属性を設定します。",
  },
  hreflang: {
    title: "言語・地域指定",
    description: "多言語・地域向けページの指定に改善余地があります。hreflang設定を確認します。",
  },
  canonical: {
    title: "canonical URL",
    description: "正規URLの指定に改善余地があります。重複ページの評価が分散しないようcanonicalを確認します。",
  },
  "structured-data": {
    title: "構造化データ",
    description: "構造化データに改善余地があります。検索エンジンが事業・サービス情報を理解しやすい形式にします。",
  },
  "font-size": {
    title: "文字サイズ",
    description: "モバイルで読みにくい文字サイズが含まれている可能性があります。本文やリンクの可読性を調整します。",
  },
  "tap-targets": {
    title: "タップ領域",
    description: "スマートフォンでタップしにくいボタンやリンクがあります。十分な余白と押しやすいサイズにします。",
  },
  "lighthouse-unavailable": {
    title: "Lighthouse計測",
    description: "Lighthouse計測が完了しなかったため、クロール結果のみで分析を継続しました。実行ログの警告に失敗理由が記録されています。",
  },
};
