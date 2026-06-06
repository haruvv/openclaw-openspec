import type { CrawlResult, LighthouseResult, SeoOpportunityResult } from "../types/index.js";
import type { BusinessSiteQualification, SeoIssueQualification, SiteCandidate } from "./types.js";

const DIRECTORY_HOST_PATTERNS = [
  "google.com",
  "maps.google.",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "yelp.",
  "hotpepper.",
  "ekiten.",
];

const LARGE_ENTERPRISE_TEXT_PATTERNS = [
  /ホールディングス/i,
  /グループ(?:会社)?/i,
  /全国(?:展開|対応|チェーン)/i,
  /チェーン店/i,
  /フランチャイズ/i,
  /FC加盟/i,
  /加盟店募集/i,
  /店舗一覧/i,
  /採用情報/i,
  /新卒採用/i,
  /中途採用/i,
  /IR情報/i,
  /投資家情報/i,
  /東証/i,
  /上場/i,
  /プライム市場/i,
  /スタンダード市場/i,
  /グロース市場/i,
  /corporate\s+profile/i,
  /investor\s+relations/i,
  /franchise/i,
  /store\s+locator/i,
  /careers?/i,
];

const LARGE_ENTERPRISE_PATH_PATTERNS = [
  /\/ir(?:\/|$)/i,
  /\/investors?(?:\/|$)/i,
  /\/recruit(?:\/|$)/i,
  /\/careers?(?:\/|$)/i,
  /\/franchise(?:\/|$)/i,
  /\/stores?(?:\/|$)/i,
  /\/shoplist(?:\/|$)/i,
];

export function qualifyBusinessSite(candidate: SiteCandidate, crawl?: CrawlResult): BusinessSiteQualification {
  if (candidate.sourceProvenance.some((source) => source.source === "google_maps") && !hasCrawlableBusinessUrl(candidate)) {
    return { status: "held", reasonCode: "maps_profile_only", message: "Maps profile exists but no website URL was found", confidence: "medium" };
  }
  if (DIRECTORY_HOST_PATTERNS.some((pattern) => candidate.domain.includes(pattern))) {
    return { status: "rejected", reasonCode: "directory_or_social_profile", message: "Candidate is a directory, listing, or social profile", confidence: "high" };
  }
  const evidence = [candidate.businessName, candidate.category, candidate.location, crawl?.title, crawl?.contactEmail].filter(Boolean).length;
  if (evidence >= 2 || candidate.sourceConfidence === "high") {
    return { status: "passed", reasonCode: "business_site_evidence", message: "Candidate has enough business-site evidence", confidence: candidate.sourceConfidence };
  }
  return { status: "rejected", reasonCode: "insufficient_business_evidence", message: "Candidate lacks business-site evidence", confidence: "low" };
}

export function qualifySmallBusinessFit(candidate: SiteCandidate): BusinessSiteQualification {
  const haystack = [
    candidate.url,
    candidate.domain,
    candidate.businessName,
    candidate.category,
    candidate.location,
    ...candidate.sourceProvenance.flatMap((source) => [source.title, source.snippet]),
  ].filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");

  if (LARGE_ENTERPRISE_TEXT_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return {
      status: "rejected",
      reasonCode: "large_enterprise_or_chain",
      message: "Candidate appears to be a large enterprise, chain, franchise, recruiting, or investor page",
      confidence: "medium",
    };
  }

  try {
    const url = new URL(candidate.url);
    if (LARGE_ENTERPRISE_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
      return {
        status: "rejected",
        reasonCode: "large_enterprise_or_chain",
        message: "Candidate URL path appears to target a large enterprise, chain, recruiting, or investor page",
        confidence: "medium",
      };
    }
  } catch {
    // Safe URL validation runs later; keep malformed handling there.
  }

  return {
    status: "passed",
    reasonCode: "small_business_fit_not_disqualified",
    message: "Candidate does not show obvious large-enterprise or chain signals",
    confidence: candidate.sourceConfidence,
  };
}

export async function qualifyApolloCompanySizeFit(candidate: SiteCandidate, env: NodeJS.ProcessEnv): Promise<BusinessSiteQualification> {
  if (!env.APOLLO_API_KEY || env.APOLLO_COMPANY_SIZE_CHECK_ENABLED === "false") {
    return {
      status: "passed",
      reasonCode: "apollo_company_size_check_not_configured",
      message: "Apollo company-size check is not configured",
      confidence: candidate.sourceConfidence,
    };
  }

  const domain = normalizeLookupDomain(candidate.domain || candidate.url);
  if (!domain) {
    return {
      status: "passed",
      reasonCode: "apollo_company_size_domain_unavailable",
      message: "Candidate domain was unavailable for Apollo company-size check",
      confidence: "low",
    };
  }

  try {
    const organization = await fetchApolloOrganizationByDomain(domain, env);
    if (!organization) {
      return {
        status: "passed",
        reasonCode: "apollo_company_size_unknown",
        message: "Apollo did not return a matching organization for this domain",
        confidence: "medium",
      };
    }

    const employeeCount = readNumber(organization.estimated_num_employees ?? organization.num_employees ?? organization.employee_count);
    const maxEmployees = readPositiveInteger(env.APOLLO_ORGANIZATION_MAX_EMPLOYEES, 1000);
    if (employeeCount !== undefined && employeeCount > maxEmployees) {
      return {
        status: "rejected",
        reasonCode: "apollo_company_too_large",
        message: `Apollo reports ${employeeCount} employees, above the configured maximum ${maxEmployees}`,
        confidence: "high",
      };
    }

    return {
      status: "passed",
      reasonCode: "apollo_company_size_fit",
      message: employeeCount === undefined ? "Apollo matched the company but did not provide employee count" : `Apollo reports ${employeeCount} employees`,
      confidence: employeeCount === undefined ? "medium" : "high",
    };
  } catch {
    return {
      status: "passed",
      reasonCode: "apollo_company_size_check_failed",
      message: "Apollo company-size check failed; candidate remains eligible",
      confidence: "low",
    };
  }
}

export function qualifySeoIssue(input: {
  lighthouse: LighthouseResult;
  opportunity: SeoOpportunityResult;
  seoThreshold: number;
  opportunityThreshold: number;
}): SeoIssueQualification {
  const seoScore = input.lighthouse.seoScore;
  if (typeof seoScore === "number" && seoScore <= input.seoThreshold) {
    return {
      status: "passed",
      reasonCode: "seo_score_below_threshold",
      message: `SEO score ${seoScore} is at or below threshold ${input.seoThreshold}`,
      seoScore,
      opportunityScore: input.opportunity.opportunityScore,
      diagnostics: input.lighthouse.diagnostics,
      opportunityFindings: input.opportunity.findings,
    };
  }
  if (input.opportunity.opportunityScore >= input.opportunityThreshold) {
    return {
      status: "passed",
      reasonCode: "opportunity_score_above_threshold",
      message: `Opportunity score ${input.opportunity.opportunityScore} is at or above threshold ${input.opportunityThreshold}`,
      seoScore,
      opportunityScore: input.opportunity.opportunityScore,
      diagnostics: input.lighthouse.diagnostics,
      opportunityFindings: input.opportunity.findings,
    };
  }
  return {
    status: "rejected",
    reasonCode: "seo_issue_below_threshold",
    message: "SEO score and opportunity score did not meet qualification thresholds",
    seoScore,
    opportunityScore: input.opportunity.opportunityScore,
    diagnostics: input.lighthouse.diagnostics,
    opportunityFindings: input.opportunity.findings,
  };
}

async function fetchApolloOrganizationByDomain(domain: string, env: NodeJS.ProcessEnv): Promise<Record<string, unknown> | null> {
  const url = new URL(env.APOLLO_ORGANIZATION_SEARCH_API_BASE_URL ?? "https://api.apollo.io/api/v1/mixed_companies/search");
  url.searchParams.append("q_organization_domains_list[]", domain);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "1");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.APOLLO_API_KEY}`,
      "x-api-key": env.APOLLO_API_KEY ?? "",
    },
  });
  if (!response.ok) throw new Error(`apollo_company_size_${response.status}`);
  const payload = await response.json() as unknown;
  const organizations = extractApolloOrganizations(payload);
  return organizations.find((organization) => normalizeLookupDomain(readString(organization.primary_domain ?? organization.domain ?? organization.website_url) ?? "") === domain) ?? organizations[0] ?? null;
}

function extractApolloOrganizations(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload)) return [];
  const organizations = payload.organizations ?? payload.accounts ?? payload.companies;
  return Array.isArray(organizations) ? organizations.filter(isRecord) : [];
}

function normalizeLookupDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0]?.replace(/^www\./, "") ?? "";
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasCrawlableBusinessUrl(candidate: SiteCandidate): boolean {
  try {
    const url = new URL(candidate.url);
    return !url.hostname.includes("google.") && !url.pathname.includes("place_id:");
  } catch {
    return false;
  }
}
