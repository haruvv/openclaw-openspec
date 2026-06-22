import { RESTAURANT_DISCOVERY_QUERIES } from "../../constants";
import type { DiscoveryFormState, DiscoverySettings, PolicyUpdatePayload, SalesOperationSettings, SideEffectPolicy } from "../../types";

export function buildDiscoveryQueries(): string[] {
  return RESTAURANT_DISCOVERY_QUERIES;
}

export function parseDiscoveryQuerySelection(queries: string[]): { industries: string[]; customQueries: string[] } {
  const generated = new Set([...RESTAURANT_DISCOVERY_QUERIES, ...LEGACY_GENERATED_DISCOVERY_QUERIES]);

  return {
    industries: [],
    customQueries: queries.filter((query) => !generated.has(query)),
  };
}

export function hasFixedDiscoveryQueryChanges(queries: string[]): boolean {
  const expected = buildDiscoveryQueries();
  const legacy = new Set(LEGACY_GENERATED_DISCOVERY_QUERIES);
  return expected.some((query) => !queries.includes(query)) || queries.some((query) => legacy.has(query));
}

export function splitLines(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [item];
    });
}

export function createPoliciesKey(policies: SideEffectPolicy[]): string {
  return policies.map((policy) => `${policy.key}:${policy.enabled ? "1" : "0"}`).join("|");
}

export function hasPolicyChanges(items: SideEffectPolicy[], savedItems: SideEffectPolicy[]): boolean {
  return items.some((item) => savedItems.find((saved) => saved.key === item.key)?.enabled !== item.enabled);
}

export function toPolicyUpdatePayload(items: SideEffectPolicy[]): PolicyUpdatePayload {
  return {
    sendEmail: items.find((item) => item.key === "sendEmail")?.enabled === true,
    sendTelegram: items.find((item) => item.key === "sendTelegram")?.enabled === true,
    createPaymentLink: items.find((item) => item.key === "createPaymentLink")?.enabled === true,
  };
}

export function createDiscoverySettingsKey(settings: DiscoverySettings): string {
  return [
    settings.queries.join("\n"),
    settings.seedUrls.join("\n"),
    settings.enabledSources.join(","),
    settings.apolloEmployeeRanges.join(","),
    settings.apolloMaxEmployees,
    settings.portalDomains.join("\n"),
    settings.portalUrls.join("\n"),
    settings.dailyQuota,
    settings.searchLimit,
    settings.sourceLimit,
    settings.country,
    settings.lang,
    settings.location,
    settings.configuredFromAdmin ? "1" : "0",
  ].join("|");
}

export function createSalesSettingsKey(settings: SalesOperationSettings): string {
  return [
    settings.defaultPaymentAmountJpy,
    settings.outreachCooldownDays,
    settings.contactDiscoveryMaxPages,
    settings.sendgridFromName,
    settings.configuredFromAdmin ? "1" : "0",
  ].join("|");
}

export function createDiscoveryFormState(settings: DiscoverySettings): DiscoveryFormState {
  const selection = parseDiscoveryQuerySelection(settings.queries);
  return {
    selectedIndustries: selection.industries,
    customQueries: selection.customQueries.join("\n"),
    seedUrls: settings.seedUrls.join("\n"),
    enabledSources: settings.enabledSources.filter((source) => source !== "apollo_organization"),
    apolloEmployeeRanges: settings.apolloEmployeeRanges,
    apolloMaxEmployees: String(settings.apolloMaxEmployees),
    portalDomains: settings.portalDomains.join("\n"),
    portalUrls: settings.portalUrls.join("\n"),
    dailyQuota: String(settings.dailyQuota),
    searchLimit: String(settings.searchLimit),
    sourceLimit: String(settings.sourceLimit),
    country: settings.country,
    lang: settings.lang,
    location: settings.location,
    configuredFromAdmin: settings.configuredFromAdmin,
  };
}

export function hasDiscoveryFormChanges(form: DiscoveryFormState, savedForm: DiscoveryFormState): boolean {
  return discoveryFormKey(form) !== discoveryFormKey(savedForm);
}

export function toggleStringValue(items: string[], value: string): string[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function discoveryFormKey(form: DiscoveryFormState): string {
  return [
    form.customQueries,
    form.seedUrls,
    form.enabledSources.join(","),
    form.apolloEmployeeRanges.join(","),
    form.apolloMaxEmployees,
    form.portalDomains,
    form.portalUrls,
    form.dailyQuota,
    form.searchLimit,
    form.sourceLimit,
    form.country,
    form.lang,
    form.location,
  ].join("|");
}

const LEGACY_GENERATED_DISCOVERY_QUERIES = [
  "美容室",
  "整体",
  "歯科",
  "税理士",
  "弁護士",
  "工務店",
  "不動産",
  "パーソナルジム",
  "士業",
  "クリニック",
  "学習塾",
  "探偵",
  "外壁塗装",
  "リフォーム",
  "エステ",
  "Web予約系店舗",
].flatMap((industry) => [
  `${industry} 公式サイト`,
  `${industry} 地域密着 公式サイト`,
]);
