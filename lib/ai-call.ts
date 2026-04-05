/**
 * Unified AI call helper — routes to OpenAI or Anthropic based on model name.
 * Auto-fallback a Ollama (local) cuando no hay conexión a internet.
 *
 * - Models starting with "claude-" → Anthropic API
 * - All others → OpenAI SDK
 * - Sin internet → Ollama local (http://localhost:11434)
 */
import OpenAI from "openai";

export interface AICallOptions {
  /** Model ID — defaults to "gpt-4o-mini" if not set */
  model?: string | null;
  systemPrompt: string;
  userMessage: string;
  /** Max output tokens — defaults to 500 */
  maxTokens?: number | null;
  /** 0-2 creativity — defaults to 0.7 */
  temperature?: number | null;
}

/** Mapea modelos cloud a equivalentes locales en Ollama */
function toOllamaModel(model: string): string {
  if (model.startsWith("claude-") || model === "gpt-4o") return "llama3:8b";
  return "llama3.2:3b"; // gpt-4o-mini y similares → modelo más ligero
}

function isNetworkError(e: unknown): boolean {
  if (e instanceof OpenAI.APIConnectionError) return true;
  if (e instanceof OpenAI.APIConnectionTimeoutError) return true;
  const msg = String(e).toLowerCase();
  return (
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("enotfound")
  );
}

async function callOllama(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  temperature: number
): Promise<string | null> {
  const ollamaModel = toOllamaModel(model);
  console.log(`[AI] 🏠 Ollama fallback → ${ollamaModel}`);

  const ollama = new OpenAI({
    apiKey: "ollama",
    baseURL: "http://localhost:11434/v1",
  });

  const response = await ollama.chat.completions.create({
    model: ollamaModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature,
  });

  return response.choices[0]?.message?.content?.trim() ?? null;
}

export async function callAI({
  model,
  systemPrompt,
  userMessage,
  maxTokens,
  temperature,
}: AICallOptions): Promise<string | null> {
  const effectiveModel = model || "gpt-4o-mini";
  const effectiveTemp = temperature ?? 0.7;
  const effectiveMaxTokens = maxTokens ?? 500;

  if (effectiveModel.startsWith("claude-")) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: effectiveModel,
          max_tokens: effectiveMaxTokens,
          temperature: effectiveTemp,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "unknown");
        process.stderr?.write?.(`[callAI Anthropic error] ${res.status}: ${err}\n`);
        return null;
      }

      const data = await res.json();
      return (data.content?.[0]?.text as string | undefined)?.trim() ?? null;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      // Sin internet → Ollama
      return callOllama(effectiveModel, systemPrompt, userMessage, effectiveMaxTokens, effectiveTemp);
    }
  }

  // OpenAI (default)
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const response = await openai.chat.completions.create({
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: effectiveMaxTokens,
      temperature: effectiveTemp,
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    // Sin internet → Ollama
    return callOllama(effectiveModel, systemPrompt, userMessage, effectiveMaxTokens, effectiveTemp);
  }
}
