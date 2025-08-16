import OpenAI from "openai";
import { config } from "dotenv";
import { logger } from "./logger.js";

config();

const DEFAULT_MODEL = "zai-org/glm-4.5";

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
    this.baseURL = baseURL || process.env.PPIO_BASE_URL;
    this.model = model || DEFAULT_MODEL;
    this.client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });
  }

  async text(
    prompt: string,
    {
      systemPrompt,
      temperature = 0.7,
    }: { systemPrompt?: string; temperature?: number } = {}
  ): Promise<string> {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });
    logger.info("prompt length:", prompt?.length || 0);
    try {
      const resp = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature,
      });
      const content = resp?.choices?.[0]?.message?.content || "";
      logger.info("LLM text response length:", content.length);
      return content;
    } catch (e: any) {
      throw new Error(`调用OpenAI API失败: ${e?.message || e}`);
    }
  }

  async json(
    prompt: string,
    {
      systemPrompt = "请以有效的JSON格式回复，不要包含任何其他文本。不要包含markdown格式的前后缀！",
      temperature = 0.3,
    }: { systemPrompt?: string; temperature?: number } = {}
  ): Promise<Record<string, unknown>> {
    try {
      const resp = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature,
        response_format: { type: "json_object" },
      });
      let content = resp?.choices?.[0]?.message?.content || "";
      content = sanitizeJson(content);
      logger.info("LLM json response length:", content.length);
      return JSON.parse(content);
    } catch (e: any) {
      logger.error("LLM json failed:", e?.message || e);
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
  s = s.replace(/,\s*([}\]])/g, "$1");
  s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '"$2":');
  s = s.replace(/,\s*$/g, "");
  return s;
}
