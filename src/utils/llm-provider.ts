import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";

export async function generateText(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  try {
    return await callGemini(prompt, systemPrompt);
  } catch (err) {
    if (!isQuotaError(err)) throw err;

    const zaiKey = process.env.ZAI_API_KEY;
    if (!zaiKey) {
      logger.warn("Gemini quota exceeded and ZAI_API_KEY is not set — cannot fallback");
      throw err;
    }

    logger.info("Gemini quota exceeded, falling back to Z.ai GLM");
    return callZai(prompt, systemPrompt, zaiKey);
  }
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callZai(
  prompt: string,
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const client = new Anthropic({
    apiKey,
    baseURL: "https://api.z.ai/api/anthropic",
  });
  const message = await client.messages.create({
    model: "glm-4-plus",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Z.ai");
  return content.text;
}

function isQuotaError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("quota") ||
      msg.includes("resource_exhausted") ||
      msg.includes("rate limit")
    );
  }
  return false;
}
