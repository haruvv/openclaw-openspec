import type { ContactMethod, ContactMethodConfidence } from "../types/index.js";
import { isContactSuppressed } from "./suppression.js";

export interface EmailDiscoveryInput {
  domain: string;
  sourceUrl: string;
  html?: string;
  limit?: number;
  env?: NodeJS.ProcessEnv;
}

export interface EmailDiscoveryReport {
  methods: ContactMethod[];
  rejected: EmailRejection[];
  providerStatuses: Array<{ provider: "hunter" | "apollo"; status: "skipped" | "passed" | "failed"; reason?: string; candidateCount: number }>;
  salesProhibited: boolean;
}

export interface EmailRejection {
  email?: string;
  provider: "hunter" | "apollo";
  reason: string;
}

type ProviderCandidate = {
  provider: "hunter" | "apollo";
  email: string;
  sourceUrl?: string;
  confidence?: number;
  verificationStatus?: string;
  emailType?: string;
  position?: string;
  department?: string;
  seniority?: string;
  firstName?: string;
  lastName?: string;
  guessed?: boolean;
  acceptAll?: boolean;
};

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.jp",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "mail.com",
  "gmx.com",
]);

const BLOCKED_LOCAL_PARTS = new Set(["noreply", "no-reply", "donotreply", "do-not-reply", "abuse", "postmaster", "privacy", "legal"]);
const RELEVANT_LOCAL_PARTS = [
  "info",
  "contact",
  "sales",
  "marketing",
  "web",
  "homepage",
  "owner",
  "office",
  "shop",
  "store",
  "reservation",
  "booking",
  "support",
  "hello",
  "admin",
  "pr",
  "press",
  "business",
  "manager",
];
const RELEVANT_ROLE_TERMS = [
  "owner",
  "founder",
  "ceo",
  "president",
  "director",
  "manager",
  "marketing",
  "sales",
  "growth",
  "web",
  "digital",
  "ecommerce",
  "shop",
  "store",
  "general manager",
  "代表",
  "社長",
  "店長",
  "院長",
  "オーナー",
  "マーケ",
  "広報",
  "営業",
  "web",
  "ウェブ",
  "ec",
];

const SALES_PROHIBITED_PATTERNS = [
  /営業.{0,30}(?:お断り|ご遠慮|禁止|拒否)/i,
  /勧誘.{0,30}(?:お断り|ご遠慮|禁止|拒否)/i,
  /セールス.{0,30}(?:お断り|ご遠慮|禁止|拒否)/i,
  /営業(?:目的|メール|のご連絡|電話)?(?:は|を)?(?:固く)?(?:お断り|ご遠慮)/i,
  /勧誘(?:目的|メール|のご連絡|電話)?(?:は|を)?(?:お断り|ご遠慮)/i,
  /セールス(?:目的|メール|のご連絡|電話)?(?:は|を)?(?:お断り|ご遠慮)/i,
  /売り込み(?:は|を)?(?:お断り|ご遠慮)/i,
  /no\s+(?:sales|solicitation|marketing)\s+(?:emails?|calls?|messages?|inquiries)/i,
  /do\s+not\s+(?:send|contact|solicit)/i,
];

export async function discoverCompliantEmailMethods(input: EmailDiscoveryInput): Promise<EmailDiscoveryReport> {
  const env = input.env ?? process.env;
  if (hasSalesProhibition(input.html ?? "")) {
    return {
      methods: [],
      rejected: [{ provider: "hunter", reason: "sales_prohibited_site" }],
      providerStatuses: [],
      salesProhibited: true,
    };
  }

  const limit = Math.max(1, input.limit ?? 3);
  const providerStatuses: EmailDiscoveryReport["providerStatuses"] = [];
  const rejected: EmailRejection[] = [];
  const accepted: ContactMethod[] = [];

  if (env.HUNTER_API_KEY) {
    try {
      const candidates = await fetchHunterCandidates(input.domain, env);
      providerStatuses.push({ provider: "hunter", status: "passed", candidateCount: candidates.length });
      const screened = await screenCandidates(candidates, input, limit - accepted.length);
      accepted.push(...screened.methods);
      rejected.push(...screened.rejected);
    } catch (err) {
      providerStatuses.push({ provider: "hunter", status: "failed", candidateCount: 0, reason: err instanceof Error ? err.message : "hunter_failed" });
    }
  } else {
    providerStatuses.push({ provider: "hunter", status: "skipped", candidateCount: 0, reason: "HUNTER_API_KEY is not set" });
  }

  if (accepted.length < limit && env.APOLLO_API_KEY) {
    try {
      const candidates = await fetchApolloCandidates(input.domain, env, limit);
      providerStatuses.push({ provider: "apollo", status: "passed", candidateCount: candidates.length });
      const screened = await screenCandidates(candidates, input, limit - accepted.length);
      accepted.push(...screened.methods);
      rejected.push(...screened.rejected);
    } catch (err) {
      providerStatuses.push({ provider: "apollo", status: "failed", candidateCount: 0, reason: err instanceof Error ? err.message : "apollo_failed" });
    }
  } else if (!env.APOLLO_API_KEY) {
    providerStatuses.push({ provider: "apollo", status: "skipped", candidateCount: 0, reason: "APOLLO_API_KEY is not set" });
  }

  return {
    methods: dedupeContactMethods(accepted).slice(0, limit),
    rejected,
    providerStatuses,
    salesProhibited: false,
  };
}

export function hasSalesProhibition(htmlOrText: string): boolean {
  const text = stripHtml(htmlOrText).replace(/\s+/g, " ").trim();
  return SALES_PROHIBITED_PATTERNS.some((pattern) => pattern.test(text));
}

async function fetchHunterCandidates(domain: string, env: NodeJS.ProcessEnv): Promise<ProviderCandidate[]> {
  const url = new URL(env.HUNTER_API_BASE_URL ?? "https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", normalizeDomain(domain));
  url.searchParams.set("api_key", env.HUNTER_API_KEY ?? "");
  url.searchParams.set("limit", env.HUNTER_EMAIL_DISCOVERY_LIMIT ?? "10");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`hunter_${response.status}`);
  const payload = await response.json() as unknown;
  if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.emails)) return [];
  const acceptAll = typeof payload.data.accept_all === "boolean" ? payload.data.accept_all : undefined;
  return payload.data.emails.flatMap((item): ProviderCandidate[] => {
    if (!isRecord(item) || typeof item.value !== "string") return [];
    const verification = isRecord(item.verification) ? item.verification : {};
    return [{
      provider: "hunter",
      email: item.value,
      sourceUrl: readHunterSourceUrl(item.sources),
      confidence: typeof item.confidence === "number" ? item.confidence : undefined,
      verificationStatus: typeof verification.status === "string" ? verification.status : undefined,
      emailType: typeof item.type === "string" ? item.type : undefined,
      position: typeof item.position === "string" ? item.position : undefined,
      department: typeof item.department === "string" ? item.department : undefined,
      seniority: typeof item.seniority === "string" ? item.seniority : undefined,
      firstName: typeof item.first_name === "string" ? item.first_name : undefined,
      lastName: typeof item.last_name === "string" ? item.last_name : undefined,
      acceptAll,
    }];
  });
}

async function fetchApolloCandidates(domain: string, env: NodeJS.ProcessEnv, limit: number): Promise<ProviderCandidate[]> {
  const url = new URL(env.APOLLO_API_BASE_URL ?? "https://api.apollo.io/api/v1/mixed_people/api_search");
  const titles = readList(env.APOLLO_EMAIL_DISCOVERY_TITLES).length > 0
    ? readList(env.APOLLO_EMAIL_DISCOVERY_TITLES)
    : ["owner", "founder", "president", "marketing", "manager", "director"];
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": env.APOLLO_API_KEY ?? "",
    },
    body: JSON.stringify({
      q_organization_domains: normalizeDomain(domain),
      person_titles: titles,
      per_page: Math.min(Math.max(limit, 1), 10),
      page: 1,
    }),
  });
  if (!response.ok) throw new Error(`apollo_${response.status}`);
  const payload = await response.json() as unknown;
  const people = isRecord(payload) && Array.isArray(payload.people)
    ? payload.people
    : isRecord(payload) && Array.isArray(payload.contacts)
      ? payload.contacts
      : [];
  return people.flatMap((item): ProviderCandidate[] => {
    if (!isRecord(item) || typeof item.email !== "string") return [];
    return [{
      provider: "apollo",
      email: item.email,
      confidence: item.email_status === "verified" ? 90 : 45,
      verificationStatus: typeof item.email_status === "string" ? item.email_status : undefined,
      position: typeof item.title === "string" ? item.title : undefined,
      department: Array.isArray(item.departments) ? item.departments.filter((value): value is string => typeof value === "string").join(", ") : undefined,
      seniority: typeof item.seniority === "string" ? item.seniority : undefined,
      firstName: typeof item.first_name === "string" ? item.first_name : undefined,
      lastName: typeof item.last_name === "string" ? item.last_name : undefined,
    }];
  });
}

async function screenCandidates(candidates: ProviderCandidate[], input: EmailDiscoveryInput, limit: number): Promise<{ methods: ContactMethod[]; rejected: EmailRejection[] }> {
  const methods: ContactMethod[] = [];
  const rejected: EmailRejection[] = [];
  for (const candidate of candidates) {
    if (methods.length >= limit) break;
    const decision = await screenCandidate(candidate, input);
    if (!decision.accepted) {
      rejected.push({ provider: candidate.provider, email: normalizeEmail(candidate.email) ?? candidate.email, reason: decision.reason });
      continue;
    }
    methods.push(decision.method);
  }
  return { methods, rejected };
}

async function screenCandidate(candidate: ProviderCandidate, input: EmailDiscoveryInput): Promise<{ accepted: true; method: ContactMethod } | { accepted: false; reason: string }> {
  const email = normalizeEmail(candidate.email);
  if (!email) return { accepted: false, reason: "invalid_email" };
  const [local = "", emailDomain = ""] = email.split("@");
  const targetDomain = normalizeDomain(input.domain);
  if (PERSONAL_EMAIL_DOMAINS.has(emailDomain)) return { accepted: false, reason: "personal_email_domain" };
  if (BLOCKED_LOCAL_PARTS.has(local)) return { accepted: false, reason: "blocked_mailbox" };
  if (!isSameOrSubdomain(emailDomain, targetDomain)) return { accepted: false, reason: "domain_mismatch" };
  if (candidate.emailType?.toLowerCase() === "personal" && !hasRelevantRole(candidate)) return { accepted: false, reason: "personal_email_type" };
  if (!hasRelevantRole(candidate) && !hasRelevantLocalPart(local)) return { accepted: false, reason: "low_role_relevance" };
  const suppression = await isContactSuppressed({ email, domain: targetDomain });
  if (suppression.suppressed) return { accepted: false, reason: suppression.kind === "email" ? "suppressed_email" : "suppressed_domain" };

  const confidence = scoreCandidateConfidence(candidate);
  return {
    accepted: true,
    method: {
      type: "email",
      value: email,
      sourceUrl: candidate.sourceUrl ?? input.sourceUrl,
      confidence,
      label: `${candidate.provider} business email`,
      reason: buildReason(candidate, confidence),
      metadata: {
        provider: candidate.provider,
        verificationStatus: candidate.verificationStatus,
        emailType: candidate.emailType,
        position: candidate.position,
        department: candidate.department,
        seniority: candidate.seniority,
        guessed: candidate.guessed === true,
        acceptAll: candidate.acceptAll === true,
      },
    },
  };
}

function scoreCandidateConfidence(candidate: ProviderCandidate): ContactMethodConfidence {
  const status = candidate.verificationStatus?.toLowerCase();
  if (candidate.guessed || candidate.acceptAll || status === "accept_all" || status === "unknown" || status === "unverified") return "low";
  if (typeof candidate.confidence === "number") {
    if (candidate.confidence >= 80) return "high";
    if (candidate.confidence >= 50) return "medium";
    return "low";
  }
  if (status === "valid" || status === "verified") return "high";
  return "medium";
}

function buildReason(candidate: ProviderCandidate, confidence: ContactMethodConfidence): string {
  const parts = [
    `provider=${candidate.provider}`,
    candidate.position ? `position=${candidate.position}` : undefined,
    candidate.verificationStatus ? `verification=${candidate.verificationStatus}` : undefined,
    candidate.emailType ? `type=${candidate.emailType}` : undefined,
    confidence === "low" ? "low_priority_provider_candidate" : undefined,
  ].filter((value): value is string => Boolean(value));
  return parts.join("; ");
}

function hasRelevantLocalPart(local: string): boolean {
  const normalized = local.toLowerCase();
  return RELEVANT_LOCAL_PARTS.some((part) => normalized === part || normalized.includes(part));
}

function hasRelevantRole(candidate: ProviderCandidate): boolean {
  const haystack = [candidate.position, candidate.department, candidate.seniority].filter(Boolean).join(" ").toLowerCase();
  return RELEVANT_ROLE_TERMS.some((term) => haystack.includes(term.toLowerCase()));
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizeDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0]?.replace(/^www\./, "") ?? trimmed;
  }
}

function isSameOrSubdomain(emailDomain: string, targetDomain: string): boolean {
  return emailDomain === targetDomain || emailDomain.endsWith(`.${targetDomain}`);
}

function dedupeContactMethods(methods: ContactMethod[]): ContactMethod[] {
  const seen = new Set<string>();
  return methods.flatMap((method) => {
    const key = `${method.type}:${method.value.toLowerCase()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [method];
  }).sort((a, b) => confidenceWeight(b.confidence) - confidenceWeight(a.confidence));
}

function confidenceWeight(confidence: ContactMethodConfidence): number {
  return { high: 3, medium: 2, low: 1 }[confidence];
}

function readHunterSourceUrl(sources: unknown): string | undefined {
  if (!Array.isArray(sources)) return undefined;
  for (const source of sources) {
    if (isRecord(source) && typeof source.uri === "string") return source.uri;
  }
  return undefined;
}

function readList(value: string | undefined): string[] {
  return value?.split(/[\n,]/).map((item) => item.trim()).filter(Boolean) ?? [];
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
