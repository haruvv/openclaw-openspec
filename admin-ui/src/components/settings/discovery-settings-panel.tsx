import React, { useEffect, useState } from "react";
import { apiCache, apiPut } from "../../api";
import { DISCOVERY_SEARCH_TARGETS } from "../../constants";
import { Panel, StatusPill } from "../common";
import type { DiscoveryFormState, DiscoverySettings } from "../../types";
import {
  buildDiscoveryQueries,
  createDiscoveryFormState,
  hasFixedDiscoveryQueryChanges,
  hasDiscoveryFormChanges,
  splitLines,
  toggleStringValue,
} from "./settings-utils";

export function DiscoverySettingsPanel({ settings }: { settings: DiscoverySettings }) {
  const [form, setForm] = useState(() => createDiscoveryFormState(settings));
  const [savedForm, setSavedForm] = useState(() => createDiscoveryFormState(settings));
  const [savedQueries, setSavedQueries] = useState(settings.queries);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    customQueries,
    seedUrls,
    enabledSources,
    apolloEmployeeRanges,
    apolloMaxEmployees,
    portalDomains,
    portalUrls,
    dailyQuota,
    searchLimit,
    sourceLimit,
    country,
    lang,
    location,
    configuredFromAdmin,
  } = form;
  const generatedQueries = buildDiscoveryQueries();
  const allQueries = [...generatedQueries, ...splitLines(customQueries)];
  const hasChanges = hasDiscoveryFormChanges(form, savedForm) || hasFixedDiscoveryQueryChanges(savedQueries);

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

  function toggleSource(source: string) {
    setForm((current) => ({
      ...current,
      enabledSources: toggleStringValue(current.enabledSources, source),
    }));
    setSaveNotice(null);
    setError(null);
  }

  function toggleApolloEmployeeRange(range: string) {
    setForm((current) => ({
      ...current,
      apolloEmployeeRanges: toggleStringValue(current.apolloEmployeeRanges, range),
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
        enabledSources,
        apolloEmployeeRanges,
        apolloMaxEmployees: Number(apolloMaxEmployees),
        portalDomains,
        portalUrls,
        dailyQuota: Number(dailyQuota),
        searchLimit: Number(searchLimit),
        sourceLimit: Number(sourceLimit),
        country,
        lang,
        location,
      });
      apiCache.delete("/api/admin/seo-sales/settings");
      const nextForm = createDiscoveryFormState(result.discovery);
      setForm(nextForm);
      setSavedForm(nextForm);
      setSavedQueries(result.discovery.queries);
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-black text-slate-700">営業対象</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md bg-white px-3 py-1.5 text-sm font-black text-slate-800 ring-1 ring-slate-200">飲食店</span>
            <span className="rounded-md bg-white px-3 py-1.5 text-sm font-black text-slate-800 ring-1 ring-slate-200">レストラン</span>
            <span className="rounded-md bg-white px-3 py-1.5 text-sm font-black text-slate-800 ring-1 ring-slate-200">カフェ・居酒屋</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">候補発見は飲食店に固定しています。美容室や汎用店舗の業種選択は使いません。</p>
        </div>
        <fieldset>
          <legend className="text-sm font-black text-slate-700">探索ソース</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DISCOVERY_SOURCE_OPTIONS.map((source) => (
              <label key={source.key} className="check-row">
                <input type="checkbox" checked={enabledSources.includes(source.key)} onChange={() => toggleSource(source.key)} />
                <span>{source.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">主探索はGoogle MapsとFirecrawl検索です。業界ポータル探索は、登録したポータルや指定サイト内から公式サイト候補を補う補助ソースです。全Web検索としては使いません。</p>
        </fieldset>
        <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1 text-sm font-black text-slate-700">業界ポータル探索</legend>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-black text-slate-700" htmlFor="portal-domains">対象ポータルドメイン</label>
              <textarea id="portal-domains" className="textarea mt-2" value={portalDomains} onChange={(event) => setFormValue("portalDomains", event.target.value)} placeholder={"restaurant-portal.example\nlocal-gourmet.example"} />
              <p className="mt-2 text-xs font-semibold text-slate-500">1行1ドメイン。Google Custom Search APIが設定済みなら、このドメイン内を `site:` 検索して掲載ページを探します。</p>
            </div>
            <div>
              <label className="text-sm font-black text-slate-700" htmlFor="portal-urls">直接読むポータルURL</label>
              <textarea id="portal-urls" className="textarea mt-2" value={portalUrls} onChange={(event) => setFormValue("portalUrls", event.target.value)} placeholder={"https://restaurant-portal.example/shop/123\nhttps://local-gourmet.example/restaurant/abc"} />
              <p className="mt-2 text-xs font-semibold text-slate-500">検索せずに確認したい掲載ページを指定します。公式サイトリンクがない掲載ページはSEO解析前に保留します。</p>
            </div>
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1 text-sm font-black text-slate-700">Apolloの補完条件</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {APOLLO_EMPLOYEE_RANGE_OPTIONS.map((range) => (
              <label key={range.key} className="check-row bg-white">
                <input type="checkbox" checked={apolloEmployeeRanges.includes(range.key)} onChange={() => toggleApolloEmployeeRange(range.key)} />
                <span>{range.label}</span>
              </label>
            ))}
          </div>
          <label className="mt-3 block text-sm font-black text-slate-700">最大従業員数<input className="input mt-2 w-full sm:max-w-xs" type="number" min="1" max="10000" value={apolloMaxEmployees} onChange={(event) => setFormValue("apolloMaxEmployees", event.target.value)} /></label>
          <p className="mt-2 text-xs font-semibold text-slate-500">Google Mapsや地域検索で集めた候補をApolloで照合し、企業規模の上限超過を除外します。担当者補完にも同じApollo連携を使います。</p>
        </fieldset>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-black text-slate-500">検索キーワードのプレビュー</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {allQueries.slice(0, 12).map((query) => <span key={query} className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{query}</span>)}
            {allQueries.length > 12 ? <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">他 {allQueries.length - 12}件</span> : null}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">飲食店の公式サイトを探し、解析結果から改善余地が大きいサイトを営業候補にします。</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-black text-slate-700">1日の解析上限<input className="input mt-2 w-full" type="number" min="1" max="10" value={dailyQuota} onChange={(event) => setFormValue("dailyQuota", event.target.value)} /></label>
          <label className="block text-sm font-black text-slate-700">検索件数/キーワード<input className="input mt-2 w-full" type="number" min="1" max="50" value={searchLimit} onChange={(event) => setFormValue("searchLimit", event.target.value)} /></label>
          <label className="block text-sm font-black text-slate-700">ソース別候補上限<input className="input mt-2 w-full" type="number" min="1" max="50" value={sourceLimit} onChange={(event) => setFormValue("sourceLimit", event.target.value)} /></label>
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
          <label className="mt-3 block text-sm font-black text-slate-700">地域名<input className="input mt-2 w-full" value={location} onChange={(event) => setFormValue("location", event.target.value)} placeholder="例: 渋谷区、横浜市、名古屋市" /></label>
          <p className="mt-2 text-xs font-semibold text-slate-500">Google Maps、Firecrawl検索、業界ポータル探索で、飲食店キーワードにこの地域名を掛け合わせます。</p>
        </fieldset>
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-700">詳細設定</summary>
          <div className="mt-3 space-y-4">
            <div>
              <label className="text-sm font-black text-slate-700" htmlFor="custom-discovery-queries">追加の検索条件</label>
              <textarea id="custom-discovery-queries" className="textarea mt-2" value={customQueries} onChange={(event) => setFormValue("customQueries", event.target.value)} placeholder={"渋谷区 レストラン 公式サイト\n横浜市 カフェ メニュー 公式サイト"} />
              <p className="mt-2 text-xs font-semibold text-slate-500">通常は空で構いません。料理ジャンルや市区町村を追加で指定したいときだけ使います。</p>
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

const DISCOVERY_SOURCE_OPTIONS = [
  { key: "seed", label: "固定URL" },
  { key: "firecrawl_search", label: "Firecrawl検索" },
  { key: "google_maps", label: "Google Maps" },
  { key: "portal_search", label: "業界ポータル探索" },
  { key: "google_search", label: "PSE指定サイト検索" },
  { key: "technology_intelligence", label: "BuiltWith/Wappalyzer" },
];

const APOLLO_EMPLOYEE_RANGE_OPTIONS = [
  { key: "1,10", label: "1-10名" },
  { key: "11,50", label: "11-50名" },
  { key: "51,200", label: "51-200名" },
  { key: "201,500", label: "201-500名" },
  { key: "501,1000", label: "501-1000名" },
];
