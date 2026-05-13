import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateContent, mockMessagesCreate } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockMessagesCreate: vi.fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

import { generateText } from "../src/utils/llm-provider.js";

const MOCK_RESPONSE = "## 現状スコア\nOK\n## 課題一覧\nOK\n## 改善提案（優先度付き）\nOK";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ZAI_API_KEY;
});

describe("generateText", () => {
  it("Gemini成功: Gemini の結果をそのまま返す", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => MOCK_RESPONSE },
    });

    const result = await generateText("prompt", "system");
    expect(result).toBe(MOCK_RESPONSE);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("429フォールバック: Gemini が 429 で ZAI_API_KEY があれば Z.ai を呼ぶ", async () => {
    process.env.ZAI_API_KEY = "test-zai-key";
    mockGenerateContent.mockRejectedValue(new Error("429 quota exceeded"));
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: MOCK_RESPONSE }],
    });

    const result = await generateText("prompt", "system");
    expect(result).toBe(MOCK_RESPONSE);
    expect(mockMessagesCreate).toHaveBeenCalledOnce();
  });

  it("ZAI_KEY未設定: Gemini が 429 で ZAI_API_KEY がなければ throw する", async () => {
    mockGenerateContent.mockRejectedValue(new Error("429 resource_exhausted"));

    await expect(generateText("prompt", "system")).rejects.toThrow("429");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("429以外のエラーはフォールバックせずに throw する", async () => {
    process.env.ZAI_API_KEY = "test-zai-key";
    mockGenerateContent.mockRejectedValue(new Error("401 unauthorized"));

    await expect(generateText("prompt", "system")).rejects.toThrow("401");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });
});
