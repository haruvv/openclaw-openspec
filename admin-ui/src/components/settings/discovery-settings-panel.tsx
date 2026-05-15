import React, { useEffect, useState } from "react";
import { apiCache, apiPut } from "../../api";
import { DISCOVERY_INDUSTRIES, DISCOVERY_SEARCH_TARGETS } from "../../constants";
import { Panel, StatusPill } from "../common";
import type { DiscoveryFormState, DiscoverySettings } from "../../types";
import {
  buildDiscoveryQueries,
  createDiscoveryFormState,
  hasDiscoveryFormChanges,
  splitLines,
  toggleStringValue,
} from "./settings-utils";

export function DiscoverySettingsPanel({ settings }: { settings: DiscoverySettings }) {
  const [form, setForm] = useState(() => createDiscoveryFormState(settings));
  const [savedForm, setSavedForm] = useState(() => createDiscoveryFormState(settings));
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    selectedIndustries,
    customQueries,
    seedUrls,
    dailyQuota,
    searchLimit,
    country,
    lang,
    location,
    configuredFromAdmin,
  } = form;
  const generatedQueries = buildDiscoveryQueries(selectedIndustries);
  const allQueries = [...generatedQueries, ...splitLines(customQueries)];
  const hasChanges = hasDiscoveryFormChanges(form, savedForm);

  useEffect(() => {
    if (!saveNotice) return;
    const timer = window.setTimeout(() => setSaveNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  function setFormValue<Key extends keyof DiscoveryFormState>(key: Key, value: DiscoveryFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveNotice(null);
    setError(null);
  }

  function toggleIndustry(industry: string) {
    setForm((current) => ({
      ...current,
      selectedIndustries: toggleStringValue(current.selectedIndustries, industry),
    }));
    setSaveNotice(null);
    setError(null);
  }

  function selectSearchTarget(target: (typeof DISCOVERY_SEARCH_TARGETS)[number]) {
    setForm((current) => ({
      ...current,
      country: target.country,
      lang: target.lang,
      location: target.location,
    }));
    setSaveNotice(null);
    setError(null);
  }

  function isSearchTargetSelected(target: (typeof DISCOVERY_SEARCH_TARGETS)[number]): boolean {
    return country === target.country && lang === target.lang && location === target.location;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!hasChanges) return;
    setSaving(true);
    setSaveNotice(null);
    setError(null);
    try {
      const result = await apiPut<{ discovery: DiscoverySettings }>("/api/admin/seo-sales/settings/discovery", {
        queries: allQueries.join("\n"),
        seedUrls,
        dailyQuota: Number(dailyQuota),
        searchLimit: Number(searchLimit),
        country,
        lang,
        location,
      });
      apiCache.delete("/api/admin/seo-sales/settings");
      const nextForm = createDiscoveryFormState(result.discovery);
      setForm(nextForm);
      setSavedForm(nextForm);
      setSaveNotice("保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定を保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="自動候補発見設定" action={configuredFromAdmin ? <StatusPill status="passed" label="管理画面設定" /> : <StatusPill status="skipped" label="環境変数設定" />}>
      <form className="space-y-4" onSubmit={save}>
        <div>
          <fieldset>
            <legend className="text-sm font-black text-slate-700">営業対象の業種</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DISCOVERY_INDUSTRIES.map((industry) => (
                <label key={industry} className="check-row">
                  <input type="checkbox" checked={selectedIndustries.includes(industry)} onChange={() => toggleIndustry(industry)} />
                  <span>{industry}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-black text-slate-500">検索キーワードのプレビュー</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {allQueries.length > 0 ? allQueries.slice(0, 12).map((query) => <span key={query} className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{query}</span>) : <span className="text-sm font-bold text-slate-500">営業対象の業種を選択してください</span>}
            {allQueries.length > 12 ? <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">他 {allQueries.length - 12}件</span> : null}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">選んだ業種の公式サイトを探し、解析結果から改善余地が大きいサイトを営業候補にします。</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-black text-slate-700">1日の解析上限<input className="input mt-2 w-full" type="number" min="1" max="10" value={dailyQuota} onChange={(event) => setFormValue("dailyQuota", event.target.value)} /></label>
          <label className="block text-sm font-black text-slate-700">検索件数/キーワード<input className="input mt-2 w-full" type="number" min="1" max="20" value={searchLimit} onChange={(event) => setFormValue("searchLimit", event.target.value)} /></label>
        </div>
        <fieldset>
          <legend className="text-sm font-black text-slate-700">検索対象</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DISCOVERY_SEARCH_TARGETS.map((target) => (
              <label key={`${target.country}-${target.lang}`} className="check-row">
                <input
                  type="radio"
                  name="discovery-search-target"
                  checked={isSearchTargetSelected(target)}
                  onChange={() => selectSearchTarget(target)}
                />
                <span>{target.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-700">詳細設定</summary>
          <div className="mt-3 space-y-4">
            <div>
              <label className="text-sm font-black text-slate-700" htmlFor="custom-discovery-queries">追加の検索条件</label>
              <textarea id="custom-discovery-queries" className="textarea mt-2" value={customQueries} onChange={(event) => setFormValue("customQueries", event.target.value)} placeholder={"港区 税理士事務所 公式サイト\n横浜市 歯科医院 公式サイト"} />
              <p className="mt-2 text-xs font-semibold text-slate-500">通常は空で構いません。チェック項目にない業種や市区町村を指定したいときだけ使います。</p>
            </div>
            <div>
              <label className="text-sm font-black text-slate-700" htmlFor="seed-urls">固定候補URL（検証用）</label>
              <textarea id="seed-urls" className="textarea mt-2" value={seedUrls} onChange={(event) => setFormValue("seedUrls", event.target.value)} placeholder={"https://example.com\nhttps://example.org"} />
              <p className="mt-2 text-xs font-semibold text-slate-500">本番運用では空で構いません。検索ではなく特定URLを解析したいときだけ使います。</p>
            </div>
          </div>
        </details>
        {hasChanges ? <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">未保存の変更があります。</div> : null}
        {saveNotice && !hasChanges ? <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{saveNotice}</div> : null}
        {error ? <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={!hasChanges || saving}>{saving ? "保存中..." : hasChanges ? "設定を保存" : "変更なし"}</button>
        </div>
      </form>
    </Panel>
  );
}
