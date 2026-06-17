import { createHash } from "node:crypto";
import type {
  LeadContactHint,
  LeadStageEvent,
  RawLeadCandidate,
  SiteCandidate,
  SourceConfidence,
  SourceProvenance,
} from "./types.js";

const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|authorization|password|bearer|cookie)/i;

export function normalizeRawLeadCandidate(raw: RawLeadCandidate, now = new Date()): SiteCandidate | null {
  const url = readCandidateUrl(raw);
  if (!url) return null;
  const normalizedUrl = normalizeComparableUrl(url);
  const domain = normalizeDomain(raw.domain ?? extractHostname(normalizedUrl));
  if (!domain) return null;

  const provenance: SourceProvenance = {
    source: raw.source,
    sourceBusinessId: cleanText(raw.sourceBusinessId),
    query: cleanText(raw.query),
    title: cleanText(raw.title),
    snippet: cleanText(raw.snippet),
    confidence: raw.confidence ?? defaultConfidence(raw.source),
    metadata: sanitizeProviderMetadata(raw.metadata ?? {}),
  };

  return {
    id: toCandidateId(normalizedUrl),
    url,
    normalizedUrl,
    domain,
    businessName: cleanText(raw.businessName),
    category: cleanText(raw.category),
    location: cleanText(raw.location),
    technologies: uniqueStrings(raw.technologies ?? []),
    contactHints: normalizeContactHints(raw.contactHints ?? [], url),
    sourceProvenance: [provenance],
    sourceConfidence: provenance.confidence,
    stageEvents: [
      {
        stage: "candidate_collected",
        status: "passed",
        reasonCode: `${raw.source}_candidate`,
        message: "Candidate collected from lead source",
        createdAt: now.toISOString(),
      },
      {
        stage: "candidate_normalized",
        status: "passed",
        reasonCode: "normalized_site_candidate",
        message: "Candidate normalized into a site candidate",
        createdAt: now.toISOString(),
      },
    ],
    metadata: sanitizeProviderMetadata(raw.metadata ?? {}),
  };
}

export function mergeSiteCandidates(candidates: SiteCandidate[], now = new Date()): SiteCandidate[] {
  const merged: SiteCandidate[] = [];
  for (const candidate of candidates) {
    const match = merged.find((existing) => areSameCandidate(existing, candidate));
    if (!match) {
      merged.push(candidate);
      continue;
    }
    if (isProfileOnlyPortalCandidate(match) && !isProfileOnlyPortalCandidate(candidate)) {
      match.url = candidate.url;
      match.normalizedUrl = candidate.normalizedUrl;
      match.domain = candidate.domain;
      match.id = candidate.id;
    }
    match.sourceProvenance = mergeProvenance(match.sourceProvenance, candidate.sourceProvenance);
    match.sourceConfidence = maxConfidence(match.sourceConfidence, candidate.sourceConfidence);
    match.technologies = uniqueStrings([...match.technologies, ...candidate.technologies]);
    match.contactHints = mergeContactHints(match.contactHints, candidate.contactHints);
    match.businessName ||= candidate.businessName;
    match.category ||= candidate.category;
    match.location ||= candidate.location;
    match.metadata = sanitizeProviderMetadata({ ...match.metadata, ...candidate.metadata });
    match.stageEvents.push(...candidate.stageEvents);
    match.stageEvents.push({
      stage: "candidate_deduped",
      status: "passed",
      reasonCode: "source_provenance_merged",
      message: "Duplicate candidate merged with existing site candidate",
      createdAt: now.toISOString(),
      metadata: { mergedSourceCount: match.sourceProvenance.length },
    });
  }
  return merged;
}

export function areSameCandidate(a: SiteCandidate, b: SiteCandidate): boolean {
  if (a.normalizedUrl === b.normalizedUrl) return true;
  if (a.domain && b.domain && a.domain === b.domain) return true;
  const aIds = new Set(a.sourceProvenance.flatMap((source) => source.sourceBusinessId ? [`${source.source}:${source.sourceBusinessId}`] : []));
  if (b.sourceProvenance.some((source) => source.sourceBusinessId && aIds.has(`${source.source}:${source.sourceBusinessId}`))) return true;
  if (isPortalOfficialComplement(a, b) || isPortalOfficialComplement(b, a)) return true;
  const aIdentity = businessIdentityKey(a);
  const bIdentity = businessIdentityKey(b);
  return Boolean(aIdentity && bIdentity && aIdentity === bIdentity);
}

export function businessIdentityKey(candidate: Pick<SiteCandidate, "businessName" | "category" | "location">): string | null {
  const name = normalizeIdentityText(candidate.businessName);
  const category = normalizeIdentityText(candidate.category);
  const location = normalizeIdentityText(candidate.location);
  if (!name || !category || !location) return null;
  return `${name}|${category}|${location}`;
}

export function normalizeComparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
      url.port = "";
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function normalizeDomain(value: string | undefined): string {
  if (!value) return "";
  const cleaned = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  return cleaned.replace(/^www\./, "");
}

export function extractHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

export function toCandidateId(value: string): string {
  return `lead_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

export function sanitizeProviderMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    sanitized[key] = sanitizeValue(item);
  }
  return sanitized;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeValue);
  if (value && typeof value === "object") return sanitizeProviderMetadata(value as Record<string, unknown>);
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return undefined;
}

function readCandidateUrl(raw: RawLeadCandidate): string | undefined {
  const direct = cleanText(raw.url);
  if (direct) return direct;
  const domain = normalizeDomain(raw.domain);
  return domain ? `https://${domain}/` : undefined;
}

function normalizeContactHints(hints: LeadContactHint[], fallbackSourceUrl: string): LeadContactHint[] {
  const seen = new Set<string>();
  return hints.flatMap((hint) => {
    const value = cleanText(hint.value);
    if (!value) return [];
    const normalized: LeadContactHint = {
      type: hint.type,
      value,
      sourceUrl: cleanText(hint.sourceUrl) ?? fallbackSourceUrl,
      confidence: hint.confidence ?? "medium",
      label: cleanText(hint.label),
      reason: cleanText(hint.reason),
    };
    const key = `${normalized.type}:${normalized.value.toLowerCase()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
}

function mergeContactHints(a: LeadContactHint[], b: LeadContactHint[]): LeadContactHint[] {
  return normalizeContactHints([...a, ...b], "");
}

function mergeProvenance(a: SourceProvenance[], b: SourceProvenance[]): SourceProvenance[] {
  const seen = new Set<string>();
  return [...a, ...b].flatMap((source) => {
    const key = `${source.source}:${source.sourceBusinessId ?? ""}:${source.query ?? ""}:${source.title ?? ""}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [source];
  });
}

function isPortalOfficialComplement(portalCandidate: SiteCandidate, officialCandidate: SiteCandidate): boolean {
  if (!isProfileOnlyPortalCandidate(portalCandidate)) return false;
  if (isProfileOnlyPortalCandidate(officialCandidate)) return false;
  const nameMatches = normalizeIdentityText(portalCandidate.businessName) && normalizeIdentityText(portalCandidate.businessName) === normalizeIdentityText(officialCandidate.businessName);
  if (!nameMatches) return false;
  if (sharedPhone(portalCandidate, officialCandidate)) return true;
  const portalLocation = normalizeIdentityText(portalCandidate.location);
  const officialLocation = normalizeIdentityText(officialCandidate.location);
  return Boolean(portalLocation && officialLocation && (portalLocation.includes(officialLocation) || officialLocation.includes(portalLocation)));
}

function isProfileOnlyPortalCandidate(candidate: SiteCandidate): boolean {
  return candidate.sourceProvenance.some((source) => source.source === "portal_search" && source.metadata.profileOnly === true);
}

function sharedPhone(a: SiteCandidate, b: SiteCandidate): boolean {
  const phones = new Set(a.contactHints.filter((hint) => hint.type === "phone").map((hint) => normalizePhone(hint.value)).filter(Boolean));
  return b.contactHints.some((hint) => hint.type === "phone" && phones.has(normalizePhone(hint.value)));
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function defaultConfidence(source: RawLeadCandidate["source"]): SourceConfidence {
  if (source === "google_maps" || source === "apollo_organization" || source === "technology_intelligence") return "high";
  if (source === "google_search" || source === "portal_search" || source === "firecrawl_search") return "medium";
  return "low";
}

function maxConfidence(a: SourceConfidence, b: SourceConfidence): SourceConfidence {
  const order: Record<SourceConfidence, number> = { low: 1, medium: 2, high: 3 };
  return order[b] > order[a] ? b : a;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const cleaned = cleanText(value);
    if (!cleaned) return [];
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [cleaned];
  });
}

function normalizeIdentityText(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 500) : undefined;
}

export function appendStageEvent(candidate: SiteCandidate, event: LeadStageEvent): SiteCandidate {
  return { ...candidate, stageEvents: [...candidate.stageEvents, event] };
}
