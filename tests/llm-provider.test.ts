import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateContent, mockFetch } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

import { generateText } from "../src/utils/llm-provider.js";

const MOCK_RESPONSE = "## 現状スコア\nOK\n## 課題一覧\nOK\n## 改善提案（優先度付き）\nOK";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ZAI_API_KEY;
  vi.stubGlobal("fetch", mockFetch);
});

describe("generateText", () => {
  it("Gemini成功: Gemini の結果をそのまま返す", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => MOCK_RESPONSE },
    });

    const result = await generateText("prompt", "system");
    expect(result).toBe(MOCK_RESPONSE);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("429フォールバック: Gemini が 429 で ZAI_API_KEY があれば Z.ai を呼ぶ", async () => {
    process.env.ZAI_API_KEY = "test-zai-key";
    mockGenerateContent.mockRejectedValue(new Error("429 quota exceeded"));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: MOCK_RESPONSE } }],
      }),
    });

    const result = await generateText("prompt", "system");
    expect(result).toBe(MOCK_RESPONSE);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("5xxフォールバック: Gemini が一時エラーで ZAI_API_KEY があれば Z.ai を呼ぶ", async () => {
    process.env.ZAI_API_KEY = "test-zai-key";
    mockGenerateContent.mockRejectedValue(new Error('500 {"error":{"code":"500","message":"Operation failed"}}'));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: MOCK_RESPONSE } }],
      }),
    });

    const result = await generateText("prompt", "system");
    expect(result).toBe(MOCK_RESPONSE);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("ZAI_KEY未設定: Gemini が 429 で ZAI_API_KEY がなければ throw する", async () => {
    mockGenerateContent.mockRejectedValue(new Error("429 resource_exhausted"));

    await expect(generateText("prompt", "system")).rejects.toThrow("429");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("認証エラーはフォールバックせずに throw する", async () => {
    process.env.ZAI_API_KEY = "test-zai-key";
    mockGenerateContent.mockRejectedValue(new Error("401 unauthorized"));

    await expect(generateText("prompt", "system")).rejects.toThrow("401");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
