const BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

export interface ChatJSONOptions {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Call the chat completions endpoint and parse the response as JSON.
 * Used for SEO meta + related content generation. Returns null on any failure
 * so callers can fall back gracefully.
 */
export async function chatCompletionJSON<T>(opts: ChatJSONOptions): Promise<T | null> {
  if (!BASE_URL || !API_KEY) return null;
  try {
    const url = `${BASE_URL.replace(/\/+$/, "")}/chat/completions`;
    const messages: Array<{ role: string; content: string }> = [];
    if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
    messages.push({ role: "user", content: opts.userPrompt });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: opts.model ?? "gpt-5-mini",
        messages,
        max_completion_tokens: opts.maxTokens ?? 800,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
