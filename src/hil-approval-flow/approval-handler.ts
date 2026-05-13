import { getDb } from "../utils/db.js";
import { verifyHilToken } from "./token.js";
import { logger } from "../utils/logger.js";

export async function handleApprove(targetId: string, token: string): Promise<boolean> {
  if (!verifyHilToken(token, targetId)) {
    logger.warn("Invalid HIL token on approve", { targetId });
    return false;
  }
  const db = await getDb();
  db.prepare("UPDATE targets SET status = 'approved', updated_at = ? WHERE id = ?").run(
    Date.now(),
    targetId
  );
  logger.info("Target approved via HIL", { targetId });
  return true;
}

export async function handleReject(targetId: string, token: string): Promise<boolean> {
  if (!verifyHilToken(token, targetId)) {
    logger.warn("Invalid HIL token on reject", { targetId });
    return false;
  }
  const db = await getDb();
  db.prepare("UPDATE targets SET status = 'rejected', updated_at = ? WHERE id = ?").run(
    Date.now(),
    targetId
  );
  logger.info("Target rejected via HIL", { targetId });
  return true;
}

const AUTO_REPLY_PATTERNS = [
  /不在/i,
  /自動返信/i,
  /out of office/i,
  /auto.?reply/i,
  /automatic.?response/i,
  /vacation/i,
];

export function isAutoReply(subject: string, body: string): boolean {
  return AUTO_REPLY_PATTERNS.some((p) => p.test(subject) || p.test(body));
}
