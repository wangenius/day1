import { config } from "dotenv";
import { z } from "zod";
import { logger } from "./logger.js";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

config();

const DEFAULT_MODEL = "gpt-5";
const DEFAULT_BASE_URL = "https://api.ppio.ai/v1";

const normalizeBaseURL = (url?: string): string => {
  if (!url) return DEFAULT_BASE_URL;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_BASE_URL;
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  if (withoutTrailingSlash.endsWith("/chat")) {
    return withoutTrailingSlash.slice(0, withoutTrailingSlash.length - 5);
  }
  return withoutTrailingSlash;
};

export class LLM {
  private apiKey?: string;
  private baseURL?: string;
  private model: string;
  private client: OpenAI;

  constructor({
    apiKey,
    model,
    baseURL,
  }: { apiKey?: string; model?: string; baseURL?: string } = {}) {
    this.apiKey = apiKey || process.env.PPIO_API_KEY;
    this.baseURL = normalizeBaseURL(baseURL || process.env.PPIO_BASE_URL);
    this.model = model || DEFAULT_MODEL;

    logger.info("LLM model:", this.model);
    logger.info(
      "LLM apiKey configured:",
      this.apiKey ? `${this.apiKey.slice(0, 4)}***` : "missing"
    );
    logger.info("LLM baseURL:", this.baseURL);
    this.client = new OpenAI({
      apiKey: this.apiKey || "",
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
      const messages: ChatCompletionMessageParam[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature,
      });
      const text =
        completion.choices?.[0]?.message?.content?.trim() || "";
      logger.info("LLM text response length:", text.length);
      if (!text) {
        throw new Error("OpenAI 返回空响应");
      }
      return text;
    } catch (e: any) {
      logger.error("LLM text failed:", e);
      throw new Error(`调用OpenAI API失败: ${e?.message || e}`);
    }
  }

  async json(
    prompt: string,
    {
      systemPrompt = "请以有效的JSON格式回复，不要包含任何其他文本。不要包含markdown格式的前后缀！",
      temperature = 0.3,
      schema = z.record(z.undefined()),
    }: {
      systemPrompt?: string;
      temperature?: number;
      schema?: z.ZodType<any>;
    } = {}
  ): Promise<any> {
    try {
      const messages: ChatCompletionMessageParam[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature,
      });
      const rawContent =
        completion.choices?.[0]?.message?.content?.trim() || "";
      if (!rawContent) {
        throw new Error("OpenAI 返回空JSON响应");
      }
      const sanitized = sanitizeJson(rawContent);
      const parsed = JSON.parse(sanitized);
      const object = schema ? schema.parse(parsed) : parsed;
      logger.info(
        "LLM json response:",
        JSON.stringify(object).length,
        "characters"
      );
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
