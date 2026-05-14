import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const ZAI_BASE_URL = process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4";
const ZAI_MODEL = process.env.ZAI_MODEL ?? "glm-4.5-flash";

export async function generateText(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  try {
    return await callGemini(prompt, systemPrompt);
  } catch (err) {
    if (!isFallbackEligibleGeminiError(err)) throw err;

    const zaiKey = process.env.ZAI_API_KEY;
    if (!zaiKey) {
      logger.warn("Gemini failed with a fallback-eligible error and ZAI_API_KEY is not set — cannot fallback");
      throw err;
    }

    logger.info("Gemini failed with a fallback-eligible error, falling back to Z.ai GLM");
    return callZai(prompt, systemPrompt, zaiKey);
  }
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
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
  const res = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ZAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
      max_tokens: 2048,
      temperature: 0.4,
    }),
  });
  const json = (await res.json()) as ZaiChatCompletionResponse;
  if (!res.ok) {
    throw new Error(`${res.status} ${JSON.stringify(json)}`);
  }
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Unexpected response type from Z.ai");
  return content;
}

function isFallbackEligibleGeminiError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("quota") ||
      msg.includes("operation failed") ||
      msg.includes("resource_exhausted") ||
      msg.includes("rate limit")
    );
  }
  return false;
}

interface ZaiChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { code?: string; message?: string };
}
