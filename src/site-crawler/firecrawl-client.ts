import FirecrawlApp from "firecrawl";
import { logger } from "../utils/logger.js";
import type { ContactMethod, CrawlResult } from "../types/index.js";

const client = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
const MAX_CONTACT_PAGES = Number(process.env.CONTACT_DISCOVERY_MAX_PAGES ?? 5);

export async function scrapeUrl(url: string): Promise<CrawlResult | null> {
  try {
    const result = await scrapePage(url);
    if (!result) {
      return null;
    }

    const domain = new URL(url).hostname;
    const title = extractTitle(result.html);
    const contactMethods = await discoverContactMethods(url, result.html);
    const contactEmail = selectPrimaryEmail(contactMethods);

    return {
      url,
      domain,
      html: result.html,
      title,
      contactEmail,
      contactMethods,
    };
  } catch (err) {
    logger.error("Firecrawl error", { url, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function scrapePage(url: string): Promise<{ html: string } | null> {
  const result = await client.scrapeUrl(url, {
    formats: ["html", "markdown"],
    actions: [],
  });

  if (!result.success) {
    logger.warn("Firecrawl scrape failed", { url, error: result.error });
    return null;
  }

  return { html: result.html ?? "" };
}

async function discoverContactMethods(url: string, html: string): Promise<ContactMethod[]> {
  const methods = extractContactMethodsFromHtml(html, url);
  const contactUrls = extractContactPageUrls(html, url);

  for (const contactUrl of contactUrls) {
    const page = await scrapePage(contactUrl).catch((err) => {
      logger.warn("Contact page scrape failed", { url: contactUrl, error: err instanceof Error ? err.message : String(err) });
      return null;
    });
    if (!page) continue;
    methods.push(...extractContactMethodsFromHtml(page.html, contactUrl));
  }

  return dedupeContactMethods(methods);
}

function extractContactMethodsFromHtml(html: string, sourceUrl: string): ContactMethod[] {
  const methods: ContactMethod[] = [];
  for (const item of extractEmails(html)) {
    methods.push({
      type: "email",
      value: item.email,
      sourceUrl,
      confidence: scoreEmailConfidence(item.email, sourceUrl, item.fromMailto),
      label: item.fromMailto ? "mailto" : "公開メール",
      reason: item.fromMailto ? "mailtoリンクから検出" : "ページ本文から検出",
    });
  }

  for (const phone of extractPhones(html)) {
    methods.push({
      type: "phone",
      value: phone,
      sourceUrl,
      confidence: isLikelyContactPage(sourceUrl) ? "medium" : "low",
      label: "電話番号",
      reason: "ページ本文から検出",
    });
  }

  if (/<form[\s>]/i.test(html)) {
    methods.push({
      type: "form",
      value: sourceUrl,
      sourceUrl,
      confidence: isLikelyContactPage(sourceUrl) ? "high" : "medium",
      label: "問い合わせフォーム",
      reason: "form要素を検出",
    });
  }

  return methods;
}

function extractContactPageUrls(html: string, baseUrl: string): string[] {
  const candidates: Array<{ url: string; score: number }> = [];
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1] ?? "");
    const label = normalizeText(stripHtml(match[2] ?? ""));
    const resolved = resolveSameOriginUrl(href, baseUrl);
    if (!resolved) continue;
    const score = contactLinkScore(resolved, label);
    if (score <= 0) continue;
    candidates.push({ url: resolved, score });
  }

  return [...new Map(candidates
    .sort((a, b) => b.score - a.score)
    .map((candidate) => [candidate.url, candidate.url])).values()]
    .slice(0, Math.max(0, MAX_CONTACT_PAGES));
}

function resolveSameOriginUrl(href: string, baseUrl: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("tel:") || href.startsWith("mailto:")) {
    return null;
  }
  try {
    const base = new URL(baseUrl);
    const url = new URL(href, base);
    if (url.origin !== base.origin) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function contactLinkScore(url: string, label: string): number {
  const haystack = `${url} ${label}`.toLowerCase();
  const high = ["contact", "inquiry", "お問い合わせ", "問合せ", "問い合わせ", "相談", "予約", "資料請求"];
  const medium = ["about", "company", "access", "office", "会社概要", "運営会社", "店舗情報", "アクセス"];
  if (high.some((term) => haystack.includes(term.toLowerCase()))) return 3;
  if (medium.some((term) => haystack.includes(term.toLowerCase()))) return 2;
  return 0;
}

function extractEmails(html: string): Array<{ email: string; fromMailto: boolean }> {
  const found = new Map<string, { email: string; fromMailto: boolean }>();
  for (const match of html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi)) {
    const email = normalizeEmail(match[1] ?? "");
    if (email) found.set(email, { email, fromMailto: true });
  }
  for (const match of html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
    const email = normalizeEmail(match[0] ?? "");
    if (!email) continue;
    const existing = found.get(email);
    found.set(email, { email, fromMailto: existing?.fromMailto === true });
  }
  return [...found.values()];
}

function extractPhones(html: string): string[] {
  const text = normalizeText(stripHtml(html));
  const phones = text.match(/(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}|\+81[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})/g) ?? [];
  return [...new Set(phones.map((phone) => phone.replace(/\s+/g, "-")))].slice(0, 3);
}

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || email.includes("example.com")) return null;
  return email;
}

function scoreEmailConfidence(email: string, sourceUrl: string, fromMailto: boolean): ContactMethod["confidence"] {
  const local = email.split("@")[0] ?? "";
  const lowValue = ["noreply", "no-reply", "abuse", "postmaster", "privacy", "support"];
  if (lowValue.includes(local)) return "low";
  if (fromMailto || isLikelyContactPage(sourceUrl)) return "high";
  return "medium";
}

function selectPrimaryEmail(methods: ContactMethod[]): string | undefined {
  return methods
    .filter((method) => method.type === "email")
    .sort((a, b) => confidenceWeight(b.confidence) - confidenceWeight(a.confidence))[0]?.value;
}

function confidenceWeight(confidence: ContactMethod["confidence"]): number {
  return { high: 3, medium: 2, low: 1 }[confidence];
}

function dedupeContactMethods(methods: ContactMethod[]): ContactMethod[] {
  const byKey = new Map<string, ContactMethod>();
  for (const method of methods) {
    const key = `${method.type}:${method.value.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing || confidenceWeight(method.confidence) > confidenceWeight(existing.confidence)) {
      byKey.set(key, method);
    }
  }
  return [...byKey.values()].sort((a, b) => confidenceWeight(b.confidence) - confidenceWeight(a.confidence));
}

function isLikelyContactPage(url: string): boolean {
  return /contact|inquiry|お問い合わせ|問合せ|問い合わせ|相談|予約/i.test(url);
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? "";
}

function stripHtml(html: string): string {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function normalizeText(text: string): string {
  return decodeHtml(text).replace(/\s+/g, " ").trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
