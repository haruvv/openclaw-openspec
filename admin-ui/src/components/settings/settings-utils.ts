import { DISCOVERY_INDUSTRIES } from "../../constants";
import type { DiscoveryFormState, DiscoverySettings, PolicyUpdatePayload, SideEffectPolicy } from "../../types";

export function buildDiscoveryQueries(industries: string[]): string[] {
  return industries.map((industry) => `${industry} 公式サイト`);
}

export function parseDiscoveryQuerySelection(queries: string[]): { industries: string[]; customQueries: string[] } {
  const industries = new Set<string>();
  const generated = new Set<string>();

  for (const industry of DISCOVERY_INDUSTRIES) {
    const currentQuery = `${industry} 公式サイト`;
    generated.add(currentQuery);
    if (queries.includes(currentQuery)) industries.add(industry);

    for (const query of queries) {
      if (query.endsWith(` ${industry} 公式サイト`)) {
        industries.add(industry);
        generated.add(query);
      }
    }
  }

  return {
    industries: [...industries],
    customQueries: queries.filter((query) => !generated.has(query)),
  };
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
    settings.dailyQuota,
    settings.searchLimit,
    settings.country,
    settings.lang,
    settings.location,
    settings.configuredFromAdmin ? "1" : "0",
  ].join("|");
}

export function createDiscoveryFormState(settings: DiscoverySettings): DiscoveryFormState {
  const selection = parseDiscoveryQuerySelection(settings.queries);
  return {
    selectedIndustries: selection.industries,
    customQueries: selection.customQueries.join("\n"),
    seedUrls: settings.seedUrls.join("\n"),
    dailyQuota: String(settings.dailyQuota),
    searchLimit: String(settings.searchLimit),
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
    form.selectedIndustries.join("\n"),
    form.customQueries,
    form.seedUrls,
    form.dailyQuota,
    form.searchLimit,
    form.country,
    form.lang,
    form.location,
  ].join("|");
}
