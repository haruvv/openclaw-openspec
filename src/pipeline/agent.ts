import { crawlBatch } from "../site-crawler/crawler.js";
import { generateProposal } from "../proposal-generator/generator.js";
import { saveProposalWithPdf } from "../proposal-generator/storage.js";
import { sendOutreachEmail } from "../outreach-sender/sender.js";
import { notifyHil } from "../hil-approval-flow/telegram-notifier.js";
import { generateHilToken, buildApprovalUrls } from "../hil-approval-flow/token.js";
import { createAndSendPaymentLink } from "../stripe-payment-link/payment-link.js";
import { saveTarget, getTargetsByStatus } from "./state.js";
import { logger } from "../utils/logger.js";
import type { Target } from "../types/index.js";

export async function runCrawlStep(urls: string[]): Promise<void> {
  logger.info("Pipeline: starting crawl", { count: urls.length });
  const { targets } = await crawlBatch(urls);
  for (const target of targets) {
    await saveTarget(target);
  }
  logger.info("Pipeline: crawl complete", { targets: targets.length });
}

export async function runProposalStep(): Promise<void> {
  const targets = await getTargetsByStatus("crawled");
  logger.info("Pipeline: generating proposals", { count: targets.length });
  for (const target of targets) {
    try {
      const markdown = await generateProposal(target);
      const { mdPath } = await saveProposalWithPdf(target.domain, markdown);
      await saveTarget({ ...target, status: "proposal_generated", proposalPath: mdPath, updatedAt: Date.now() });
    } catch (err) {
      logger.error("Proposal generation failed", { domain: target.domain, err });
    }
  }
}

export async function runOutreachStep(): Promise<void> {
  const targets = await getTargetsByStatus("proposal_generated");
  logger.info("Pipeline: queuing outreach", { count: targets.length });
  for (const target of targets) {
    await saveTarget({ ...target, status: "outreach_queued", updatedAt: Date.now() });
  }
}

export async function runSendStep(): Promise<void> {
  const targets = await getTargetsByStatus("outreach_queued");
  logger.info("Pipeline: sending outreach emails", { count: targets.length });
  for (const target of targets) {
    const result = await sendOutreachEmail(target);
    if (result.status === "sent") {
      const token = generateHilToken(target.id);
      await runHilStep({
        ...target,
        status: "outreach_sent",
        hilToken: token,
        updatedAt: Date.now(),
      });
    } else if (result.status === "skipped") {
      await saveTarget({
        ...target,
        status: "skipped",
        updatedAt: Date.now(),
      });
    }
  }
}

export async function runHilStep(target: Target): Promise<void> {
  if (!target.hilToken) return;
  const { approveUrl, rejectUrl } = buildApprovalUrls(target.id, target.hilToken);
  await notifyHil({
    targetId: target.id,
    domain: target.domain,
    seoScore: target.seoScore,
    approveUrl,
    rejectUrl,
  });
  await saveTarget({ ...target, status: "hil_pending", updatedAt: Date.now() });
}

export async function runPaymentStep(): Promise<void> {
  const targets = await getTargetsByStatus("approved");
  logger.info("Pipeline: creating payment links", { count: targets.length });
  for (const target of targets) {
    try {
      await createAndSendPaymentLink(target.id);
    } catch (err) {
      logger.error("Payment link creation failed", { domain: target.domain, err });
    }
  }
}
