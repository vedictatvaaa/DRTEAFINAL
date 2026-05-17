const BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

export async function generateImageBuffer(
  prompt: string,
  size: ImageSize = "1024x1024",
): Promise<Buffer> {
  if (!BASE_URL || !API_KEY) {
    throw new Error("OpenAI integration not configured (missing env vars)");
  }
  const url = `${BASE_URL.replace(/\/+$/, "")}/images/generations`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size,
      n: 1,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI image generation failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = json.data?.[0];
  if (!item) throw new Error("OpenAI returned no image");
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(`Failed to download generated image: ${r.status}`);
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  }
  throw new Error("OpenAI image response had neither b64_json nor url");
}
