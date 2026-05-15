import type {
  CrawlResult,
  LighthouseResult,
  SeoDiagnostic,
  SeoOpportunityCategory,
  SeoOpportunityFinding,
  SeoOpportunityResult,
  SeoOpportunitySeverity,
} from "../types/index.js";

interface FindingInput {
  category: SeoOpportunityCategory;
  severity: SeoOpportunitySeverity;
  title: string;
  evidence: string;
  recommendation: string;
  scoreImpact: number;
}

export function scoreSeoOpportunity(crawl: CrawlResult, lighthouse: LighthouseResult): SeoOpportunityResult {
  const html = crawl.html ?? "";
  const text = normalizeText(stripHtml(html));
  const title = normalizeText(crawl.title || extractTagText(html, "title"));
  const metaDescription = normalizeText(extractMetaDescription(html));
  const h1s = extractHeadingText(html, "h1");
  const h2s = extractHeadingText(html, "h2");
  const links = extractLinkTexts(html);
  const findings: SeoOpportunityFinding[] = [
    ...technicalFindings(lighthouse.diagnostics),
    ...contentFindings({ text, title, metaDescription, h1s, h2s }),
    ...intentFindings({ text, title, h1s, domain: crawl.domain }),
    ...conversionFindings({ html, text, links, contactEmail: crawl.contactEmail }),
    ...trustFindings({ text, links }),
  ].map(toFinding);

  const opportunityScore = Math.min(100, findings.reduce((sum, finding) => sum + finding.scoreImpact, 0));
  return { opportunityScore, findings };
}

function technicalFindings(diagnostics: SeoDiagnostic[]): FindingInput[] {
  return diagnostics
    .filter((diagnostic) => typeof diagnostic.score === "number" && diagnostic.score < 1)
    .slice(0, 5)
    .map((diagnostic) => ({
      category: "technical",
      severity: diagnostic.score === 0 ? "high" : "medium",
      title: `技術SEO: ${diagnostic.title}`,
      evidence: diagnostic.description || `${diagnostic.id} が Lighthouse で減点されています。`,
      recommendation: "Lighthouse の該当診断を修正し、検索エンジンがページ内容を理解しやすい状態にします。",
      scoreImpact: diagnostic.score === 0 ? 12 : 7,
    }));
}

function contentFindings(input: {
  text: string;
  title: string;
  metaDescription: string;
  h1s: string[];
  h2s: string[];
}): FindingInput[] {
  const findings: FindingInput[] = [];
  const wordLikeCount = countWordLikeUnits(input.text);

  if (input.title.length < 18 || input.title.length > 70) {
    findings.push({
      category: "content",
      severity: "medium",
      title: "検索結果で伝わるタイトルに改善余地があります",
      evidence: input.title ? `現在のtitle: ${truncate(input.title, 90)}` : "title が取得できませんでした。",
      recommendation: "主要サービス、対象顧客、強みが一目で伝わるtitleに調整します。",
      scoreImpact: 9,
    });
  }

  if (input.metaDescription.length < 70 || input.metaDescription.length > 160) {
    findings.push({
      category: "content",
      severity: "medium",
      title: "meta description の訴求が弱い可能性があります",
      evidence: input.metaDescription ? `現在のdescription: ${truncate(input.metaDescription, 110)}` : "meta description が取得できませんでした。",
      recommendation: "検索ユーザーの悩み、提供価値、問い合わせ導線を含めた説明文にします。",
      scoreImpact: 8,
    });
  }

  if (input.h1s.length !== 1) {
    findings.push({
      category: "content",
      severity: input.h1s.length === 0 ? "high" : "medium",
      title: "H1構造に改善余地があります",
      evidence: `検出したH1数: ${input.h1s.length}`,
      recommendation: "ページ主題を表すH1を1つに整理し、サービス内容が伝わる見出しにします。",
      scoreImpact: input.h1s.length === 0 ? 12 : 7,
    });
  }

  if (input.h2s.length < 2) {
    findings.push({
      category: "content",
      severity: "medium",
      title: "見出しで情報を整理できていません",
      evidence: `検出したH2数: ${input.h2s.length}`,
      recommendation: "課題、サービス内容、料金、事例、FAQなどを見出しで分け、検索意図に答える構成にします。",
      scoreImpact: 8,
    });
  }

  if (wordLikeCount < 450) {
    findings.push({
      category: "content",
      severity: wordLikeCount < 220 ? "high" : "medium",
      title: "本文量が少なく、検索意図に答えきれていない可能性があります",
      evidence: `本文量の目安: ${wordLikeCount} units`,
      recommendation: "サービス説明、対応範囲、選ばれる理由、よくある質問を追加します。",
      scoreImpact: wordLikeCount < 220 ? 16 : 10,
    });
  }

  return findings;
}

function intentFindings(input: { text: string; title: string; h1s: string[]; domain: string }): FindingInput[] {
  const combined = `${input.title} ${input.h1s.join(" ")} ${input.text}`.toLowerCase();
  const serviceTerms = [
    "service",
    "solution",
    "pricing",
    "case",
    "contact",
    "サービス",
    "料金",
    "事例",
    "相談",
    "予約",
    "導入",
    "解決",
  ];
  const matched = serviceTerms.filter((term) => combined.includes(term)).length;
  if (matched >= 3) return [];

  return [{
    category: "intent",
    severity: "medium",
    title: "検索ユーザーの目的に対する訴求が弱い可能性があります",
    evidence: `サービス・料金・事例・相談などの意図語の検出数: ${matched}`,
    recommendation: "想定顧客が探すサービス名、課題、導入メリットをファーストビューと見出しに明示します。",
    scoreImpact: 12,
  }];
}

function conversionFindings(input: {
  html: string;
  text: string;
  links: string[];
  contactEmail?: string;
}): FindingInput[] {
  const findings: FindingInput[] = [];
  const text = `${input.text} ${input.links.join(" ")}`.toLowerCase();
  const hasForm = /<form[\s>]/i.test(input.html);
  const hasPhone = /tel:|\d{2,4}[-\s)]?\d{2,4}[-\s]?\d{3,4}/i.test(input.html);
  const hasContact = Boolean(input.contactEmail) || hasPhone || includesAny(text, ["contact", "お問い合わせ", "問合せ", "相談", "予約", "資料請求"]);
  const hasStrongCta = includesAny(text, ["無料相談", "問い合わせる", "お問い合わせ", "予約する", "資料請求", "book", "contact us", "get started"]);

  if (!hasContact) {
    findings.push({
      category: "conversion",
      severity: "high",
      title: "問い合わせ導線が見つかりにくい状態です",
      evidence: "メール、電話、問い合わせリンク、予約導線を本文から検出できませんでした。",
      recommendation: "ファーストビューとページ下部に問い合わせ・相談・予約の導線を配置します。",
      scoreImpact: 18,
    });
  }

  if (!hasForm && !hasStrongCta) {
    findings.push({
      category: "conversion",
      severity: "medium",
      title: "行動を促すCTAに改善余地があります",
      evidence: "フォームまたは明確なCTA文言を検出できませんでした。",
      recommendation: "無料相談、資料請求、予約など次の行動が明確なCTAを追加します。",
      scoreImpact: 12,
    });
  }

  return findings;
}

function trustFindings(input: { text: string; links: string[] }): FindingInput[] {
  const combined = `${input.text} ${input.links.join(" ")}`.toLowerCase();
  const proofSignals = ["review", "testimonial", "case", "certified", "award", "導入事例", "事例", "実績", "お客様の声", "レビュー", "認定", "受賞"];
  const companySignals = ["about", "company", "team", "会社概要", "運営会社", "代表", "所在地"];
  const matchedProof = proofSignals.filter((term) => combined.includes(term)).length;
  const matchedCompany = companySignals.filter((term) => combined.includes(term)).length;
  const findings: FindingInput[] = [];

  if (matchedProof === 0) {
    findings.push({
      category: "trust",
      severity: "medium",
      title: "信頼材料が不足している可能性があります",
      evidence: "事例、実績、レビュー、お客様の声などを検出できませんでした。",
      recommendation: "導入事例、実績数、レビュー、認定情報を追加して問い合わせ前の不安を減らします。",
      scoreImpact: 10,
    });
  }

  if (matchedCompany === 0) {
    findings.push({
      category: "trust",
      severity: "low",
      title: "運営者情報への導線に改善余地があります",
      evidence: "会社概要、所在地、代表者などの信頼補強要素を検出できませんでした。",
      recommendation: "会社概要や運営者情報へのリンクを分かりやすく配置します。",
      scoreImpact: 6,
    });
  }

  return findings;
}

function toFinding(input: FindingInput): SeoOpportunityFinding {
  return {
    ...input,
    scoreImpact: Math.max(1, Math.min(25, Math.round(input.scoreImpact))),
  };
}

function extractMetaDescription(html: string): string {
  const match = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
  return decodeHtml(match?.[1] ?? "");
}

function extractTagText(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return normalizeText(stripHtml(match?.[1] ?? ""));
}

function extractHeadingText(html: string, tag: "h1" | "h2"): string[] {
  return [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((match) => normalizeText(stripHtml(match[1] ?? "")))
    .filter(Boolean);
}

function extractLinkTexts(html: string): string[] {
  return [...html.matchAll(/<a\s+[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => normalizeText(stripHtml(match[1] ?? "")))
    .filter(Boolean);
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

function countWordLikeUnits(text: string): number {
  const asciiWords = text.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  const cjkChars = text.match(/[\u3040-\u30ff\u3400-\u9fff]/g)?.length ?? 0;
  return asciiWords + Math.ceil(cjkChars / 2);
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
