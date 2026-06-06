import { DISCOVERY_INDUSTRIES } from "../../constants";
import type { DiscoveryFormState, DiscoverySettings, PolicyUpdatePayload, SalesOperationSettings, SideEffectPolicy } from "../../types";

export function buildDiscoveryQueries(industries: string[]): string[] {
  return industries.flatMap((industry) => [
    `${industry} 公式サイト`,
    `${industry} 地域密着 公式サイト`,
  ]);
}

export function parseDiscoveryQuerySelection(queries: string[]): { industries: string[]; customQueries: string[] } {
  const industries = new Set<string>();
  const generated = new Set<string>();

  for (const industry of DISCOVERY_INDUSTRIES) {
    for (const currentQuery of buildDiscoveryQueries([industry])) {
      generated.add(currentQuery);
      if (queries.includes(currentQuery)) industries.add(industry);
    }

    for (const query of queries) {
      if (query.endsWith(` ${industry} 公式サイト`) || query.endsWith(` ${industry} 地域密着 公式サイト`)) {
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
    settings.enabledSources.join(","),
    settings.apolloEmployeeRanges.join(","),
    settings.apolloMaxEmployees,
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
    form.selectedIndustries.join("\n"),
    form.customQueries,
    form.seedUrls,
    form.enabledSources.join(","),
    form.apolloEmployeeRanges.join(","),
    form.apolloMaxEmployees,
    form.dailyQuota,
    form.searchLimit,
    form.sourceLimit,
    form.country,
    form.lang,
    form.location,
  ].join("|");
}
