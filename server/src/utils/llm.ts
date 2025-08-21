import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, generateObject } from "ai";
import { config } from "dotenv";
import { z } from "zod";
import { logger } from "./logger.js";

config();

const DEFAULT_MODEL = "zai-org/glm-4.5";

// Create PPIO provider
function createPPIOProvider({
  apiKey,
  baseURL,
}: {
  apiKey?: string;
  baseURL?: string;
}) {
  return createOpenAICompatible({
    name: "ppio",
    apiKey: apiKey || process.env.PPIO_API_KEY || "",
    baseURL: baseURL || process.env.PPIO_BASE_URL || "https://api.ppio.ai/v1",
  });
}

export class LLM {
  private apiKey?: string;
  private baseURL?: string;
  private model: string;
  private client: ReturnType<typeof createPPIOProvider>;

  constructor({
    apiKey,
    model,
    baseURL,
  }: { apiKey?: string; model?: string; baseURL?: string } = {}) {
    this.apiKey = apiKey || process.env.PPIO_API_KEY;
    this.baseURL = baseURL || process.env.PPIO_BASE_URL;
    this.model = model || DEFAULT_MODEL;

    logger.info("LLM model:", this.model);
    logger.info("LLM apiKey:", this.apiKey);
    logger.info("LLM baseURL:", this.baseURL);
    this.client = createPPIOProvider({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });
  }

  async text(
    prompt: string,
    {
      systemPrompt,
      temperature = 0.7,
    }: { systemPrompt?: string; temperature?: number } = {}
  ): Promise<string> {
    logger.info("prompt length:", prompt?.length || 0);
    try {
      const { text } = await generateText({
        model: this.client.chatModel(this.model),
        system: systemPrompt,
        prompt,
        temperature,
      });
      logger.info("LLM text response length:", text.length);
      return text;
    } catch (e: any) {
      throw new Error(`调用OpenAI API失败: ${e?.message || e}`);
    }
  }

  async json(
    prompt: string,
    {
      systemPrompt = "请以有效的JSON格式回复，不要包含任何其他文本。不要包含markdown格式的前后缀！",
      temperature = 0.3,
      schema = z.record(z.unknown()),
    }: { systemPrompt?: string; temperature?: number; schema?: z.ZodType<any> } = {}
  ): Promise<any> {
    try {
      const { object } = await generateObject({
        model: this.client.chatModel(this.model),
        system: systemPrompt,
        prompt,
        temperature,
        schema,
      });
      logger.info("LLM json response:", JSON.stringify(object).length, "characters");
      return object;
    } catch (e: any) {
      logger.error("LLM json failed:", e);
      throw new Error(`调用OpenAI API失败: ${e?.message || e}`);
    }
  }
}

function sanitizeJson(content: string): string {
  let s = (content || "").trim();
  if (s.startsWith("```json")) s = s.slice(7);
  if (s.startsWith("```")) s = s.slice(3);
  if (s.endsWith("```")) s = s.slice(0, -3);
  s = s.trim();
  return s;
}
