import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../utils/logger.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? "./output/proposals";

export async function saveProposal(domain: string, markdown: string): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const sanitized = domain.replace(/[^a-zA-Z0-9.-]/g, "_");
  const mdPath = join(OUTPUT_DIR, `${sanitized}.md`);
  await writeFile(mdPath, markdown, "utf-8");
  logger.info("Proposal saved", { path: mdPath });
  return mdPath;
}

export async function saveProposalWithPdf(
  domain: string,
  markdown: string
): Promise<{ mdPath: string; pdfPath?: string }> {
  const mdPath = await saveProposal(domain, markdown);

  try {
    const { mdToPdf } = await import("md-to-pdf");
    const pdfPath = mdPath.replace(/\.md$/, ".pdf");
    await mdToPdf({ content: markdown }, { dest: pdfPath });
    logger.info("PDF generated", { path: pdfPath });
    return { mdPath, pdfPath };
  } catch (err) {
    logger.error("PDF conversion failed, keeping markdown only", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { mdPath };
  }
}
