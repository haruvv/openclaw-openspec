import sgMail from "@sendgrid/mail";
import { readFile } from "node:fs/promises";
import { getDb } from "../utils/db.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { Target } from "../types/index.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const MAX_DAILY = Number(process.env.MAX_DAILY_EMAILS ?? 50);
const COOLDOWN_DAYS = Number(process.env.OUTREACH_COOLDOWN_DAYS ?? 30);

export type OutreachSendResult =
  | { status: "sent" }
  | { status: "skipped"; reason: "missing_contact" | "duplicate" }
  | { status: "queued"; reason: "daily_limit" };

export async function sendOutreachEmail(target: Target): Promise<OutreachSendResult> {
  if (!target.contactEmail) {
    logger.warn("No contact email, skipping", { domain: target.domain });
    return { status: "skipped", reason: "missing_contact" };
  }

  const db = await getDb();

  if (isDuplicate(db, target.domain)) {
    logger.info("Duplicate domain within cooldown, skipping", { domain: target.domain });
    return { status: "skipped", reason: "duplicate" };
  }

  if (isDailyLimitReached(db)) {
    logger.info("Daily email limit reached, queuing for tomorrow", { domain: target.domain });
    return { status: "queued", reason: "daily_limit" };
  }

  const proposalMd = target.proposalPath
    ? await readFile(target.proposalPath, "utf-8").catch(() => "")
    : "";

  await withRetry(() =>
    sgMail.send({
      to: target.contactEmail!,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL!,
        name: process.env.SENDGRID_FROM_NAME ?? "SEO Consultant",
      },
      subject: `【無料診断結果】${target.domain} のSEO改善提案`,
      text: buildEmailText(target, proposalMd),
      html: buildEmailHtml(target, proposalMd),
    })
  );

  db.prepare("INSERT INTO outreach_log (domain, sent_at) VALUES (?, ?)").run(
    target.domain,
    Date.now()
  );

  logger.info("Outreach email sent", { domain: target.domain, to: target.contactEmail });
  return { status: "sent" };
}

function isDuplicate(db: Database.Database, domain: string): boolean {
  const cutoff = Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const row = db
    .prepare("SELECT 1 FROM outreach_log WHERE domain = ? AND sent_at > ?")
    .get(domain, cutoff);
  return row !== undefined;
}

function isDailyLimitReached(db: Database.Database): boolean {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const count = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM outreach_log WHERE sent_at >= ?")
      .get(dayStart.getTime()) as { cnt: number }
  ).cnt;
  return count >= MAX_DAILY;
}

function buildEmailText(target: Target, proposal: string): string {
  return `${target.domain} 様

貴社ウェブサイトのSEO診断を行いましたところ、改善の余地が大きいことがわかりました。
診断スコア: ${target.seoScore}/100

${proposal}

ご興味をお持ちいただけましたら、お気軽にご返信ください。
`;
}

function buildEmailHtml(target: Target, proposal: string): string {
  const escapedProposal = proposal
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<p><strong>${target.domain}</strong> 様</p>
<p>貴社ウェブサイトのSEO診断を行いましたところ、改善の余地が大きいことがわかりました。</p>
<p>診断スコア: <strong>${target.seoScore}/100</strong></p>
<pre style="background:#f5f5f5;padding:16px;border-radius:4px">${escapedProposal}</pre>
<p>ご興味をお持ちいただけましたら、お気軽にご返信ください。</p>`;
}

import type Database from "better-sqlite3";
