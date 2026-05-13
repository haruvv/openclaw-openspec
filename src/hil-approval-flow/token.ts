import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SECRET = process.env.HIL_APPROVAL_TOKEN_SECRET ?? "change-me-in-production";
const BASE_URL = process.env.HIL_APPROVAL_BASE_URL ?? "http://localhost:3000";

export function generateHilToken(targetId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${targetId}:${nonce}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyHilToken(token: string, targetId: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;
    const [storedId, nonce, sig] = parts;
    if (storedId !== targetId) return false;
    const expected = createHmac("sha256", SECRET)
      .update(`${storedId}:${nonce}`)
      .digest("hex");
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function buildApprovalUrls(targetId: string, token: string): { approveUrl: string; rejectUrl: string } {
  return {
    approveUrl: `${BASE_URL}/hil/approve?targetId=${encodeURIComponent(targetId)}&token=${encodeURIComponent(token)}`,
    rejectUrl: `${BASE_URL}/hil/reject?targetId=${encodeURIComponent(targetId)}&token=${encodeURIComponent(token)}`,
  };
}
