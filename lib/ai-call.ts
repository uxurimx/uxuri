/**
 * Unified AI call helper — routes to OpenAI or Anthropic based on model name.
 * - Models starting with "claude-" → Anthropic API (via fetch, no SDK needed)
 * - All others → OpenAI SDK
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
    // Anthropic Messages API
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
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      process.stderr?.write?.(`[callAI Anthropic error] ${res.status}: ${err}\n`);
      return null;
    }

    const data = await res.json();
    return (data.content?.[0]?.text as string | undefined)?.trim() ?? null;
  }

  // OpenAI (default)
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
}
