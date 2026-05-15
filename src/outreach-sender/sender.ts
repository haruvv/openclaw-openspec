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
  | { status: "skipped"; reason: "missing_contact" | "duplicate" | "pending_human_approval" }
  | { status: "queued"; reason: "daily_limit" };

export async function sendOutreachEmail(
  target: Target,
  options: { humanApproved?: boolean } = {}
): Promise<OutreachSendResult> {
  if (!target.contactEmail) {
    logger.warn("No contact email, skipping", { domain: target.domain });
    return { status: "skipped", reason: "missing_contact" };
  }

  if (options.humanApproved !== true) {
    logger.info("Outreach email awaiting human approval", { domain: target.domain });
    return { status: "skipped", reason: "pending_human_approval" };
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
      subject: target.llmRevenueAudit?.outreach.subject ?? `【簡易診断のご共有】${target.domain} のホームページについて`,
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
  const firstContact = target.llmRevenueAudit?.outreach.firstEmail;
  if (firstContact) return firstContact;

  return `${target.domain} 様

突然のご連絡失礼いたします。
公開されているホームページを確認した範囲で、検索結果での見え方や問い合わせ導線について、いくつか簡単に共有できそうな点がありました。

もしご迷惑でなければ、無料の簡易診断として要点だけお送りします。
ご希望でしたら、このメールにご返信ください。

${proposal ? `\n参考メモ:\n${proposal}` : ""}
`;
}

function buildEmailHtml(target: Target, proposal: string): string {
  const firstContact = target.llmRevenueAudit?.outreach.firstEmail;
  if (firstContact) {
    return firstContact
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  const escapedProposal = proposal
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<p><strong>${target.domain}</strong> 様</p>
<p>突然のご連絡失礼いたします。</p>
<p>公開されているホームページを確認した範囲で、検索結果での見え方や問い合わせ導線について、いくつか簡単に共有できそうな点がありました。</p>
<p>もしご迷惑でなければ、無料の簡易診断として要点だけお送りします。ご希望でしたら、このメールにご返信ください。</p>
${escapedProposal ? `<pre style="background:#f5f5f5;padding:16px;border-radius:4px">${escapedProposal}</pre>` : ""}`;
}

import type Database from "better-sqlite3";
