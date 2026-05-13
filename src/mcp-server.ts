import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  runCrawlStep,
  runProposalStep,
  runOutreachStep,
  runSendStep,
  runPaymentStep,
} from "./pipeline/agent.js";
import { getTargetsByStatus } from "./pipeline/state.js";

const server = new McpServer({ name: "seo-outreach-pipeline", version: "0.1.0" });

server.tool(
  "crawl_sites",
  "Crawl a list of URLs, score their SEO with Lighthouse, and store low-scoring targets",
  { urls: z.array(z.string().url()).describe("List of URLs to crawl (max 50)") },
  async ({ urls }) => {
    await runCrawlStep(urls);
    const targets = await getTargetsByStatus("crawled");
    return {
      content: [
        {
          type: "text",
          text: `Crawled ${urls.length} URLs. Found ${targets.length} low-score targets.`,
        },
      ],
    };
  }
);

server.tool(
  "generate_proposals",
  "Generate SEO improvement proposals for all crawled targets",
  {},
  async () => {
    await runProposalStep();
    const targets = await getTargetsByStatus("proposal_generated");
    return {
      content: [{ type: "text", text: `Generated proposals for ${targets.length} targets.` }],
    };
  }
);

server.tool(
  "queue_outreach",
  "Move proposal_generated targets to outreach_queued status",
  {},
  async () => {
    await runOutreachStep();
    const targets = await getTargetsByStatus("outreach_queued");
    return {
      content: [{ type: "text", text: `Queued outreach for ${targets.length} targets.` }],
    };
  }
);

server.tool(
  "send_outreach",
  "Send outreach emails for all queued targets (subject to daily limit and duplicate check)",
  {},
  async () => {
    await runSendStep();
    const targets = await getTargetsByStatus("outreach_sent");
    return {
      content: [{ type: "text", text: `Sent outreach emails. ${targets.length} targets awaiting HIL.` }],
    };
  }
);

server.tool(
  "create_payment_links",
  "Create and send Stripe Payment Links for all HIL-approved targets",
  {},
  async () => {
    await runPaymentStep();
    const targets = await getTargetsByStatus("payment_link_sent");
    return {
      content: [{ type: "text", text: `Payment links sent to ${targets.length} targets.` }],
    };
  }
);

server.tool(
  "get_pipeline_status",
  "Get current counts by pipeline status",
  {},
  async () => {
    const statuses = [
      "crawled", "proposal_generated", "outreach_queued",
      "outreach_sent", "hil_pending", "approved", "rejected",
      "payment_link_sent", "paid", "on_hold", "error",
    ] as const;
    const counts: Record<string, number> = {};
    for (const s of statuses) {
      counts[s] = (await getTargetsByStatus(s)).length;
    }
    return {
      content: [{ type: "text", text: JSON.stringify(counts, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
