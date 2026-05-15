import { getDb } from "../utils/db.js";
import { notifyHil } from "./telegram-notifier.js";
import { buildApprovalUrls } from "./token.js";
import { logger } from "../utils/logger.js";

const TIMEOUT_MS = 48 * 60 * 60 * 1000;

interface TargetRow {
  id: string;
  domain: string;
  seo_score: number;
  hil_token: string;
  updated_at: number;
}

export async function checkHilTimeouts(): Promise<void> {
  const db = await getDb();
  const cutoff = Date.now() - TIMEOUT_MS;

  const stale = db
    .prepare(
      "SELECT id, domain, seo_score, hil_token, updated_at FROM targets WHERE status = 'hil_pending' AND updated_at < ?"
    )
    .all(cutoff) as TargetRow[];

  for (const row of stale) {
    db.prepare("UPDATE targets SET status = 'on_hold', updated_at = ? WHERE id = ?").run(
      Date.now(),
      row.id
    );

    const { approveUrl, rejectUrl } = buildApprovalUrls(row.id, row.hil_token);
    await notifyHil({
      targetId: row.id,
      domain: row.domain,
      seoScore: row.seo_score,
      approveUrl: approveUrl + "&reminder=1",
      rejectUrl: rejectUrl + "&reminder=1",
    });

    logger.info("HIL timed out, moved to on_hold and re-notified", { targetId: row.id });
  }
}
