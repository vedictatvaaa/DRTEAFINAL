import { chatCompletionJSON } from "./openaiText";
import { logger } from "./logger";

export type ModerationDecision = "approve" | "reject";

export interface ModerationResult {
  decision: ModerationDecision;
  reason: string;
  /** True when AI was offline and we defaulted to allow-with-flag for admin review. */
  degraded?: boolean;
}

interface AiResponse {
  decision?: string;
  reason?: string;
}

const SYSTEM_PROMPT = `You are the community moderator for Dr Tea, a premium Indian tea brand.
You decide whether a user-submitted blog post or comment is allowed on the public Dr Tea Journal.

REJECT (decision="reject") if the content contains ANY of:
- Vulgar, obscene, sexual, or hateful language
- Personal attacks, threats, or harassment
- Spam, promotional links, competing brands, or contact-scraping
- Negative claims, complaints, or attacks against Dr Tea products, ingredients, sourcing, pricing, or staff
- Medical claims (e.g. "cures diabetes")

APPROVE (decision="approve") otherwise — including neutral, positive, or constructive tea content.

Always return strict JSON: { "decision": "approve" | "reject", "reason": "<one short sentence>" }.`;

const HARD_BLOCK_WORDS = [
  // Quick local guard for the most obvious obscenities so we never need an
  // AI round-trip for them. Keep short — full nuance is the AI's job.
  "fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "slut",
];

function quickReject(text: string): string | null {
  const lower = text.toLowerCase();
  for (const w of HARD_BLOCK_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(lower)) return `Contains blocked language ("${w}").`;
  }
  return null;
}

export async function moderateContent(
  text: string,
  kind: "post" | "comment",
): Promise<ModerationResult> {
  const trimmed = text.trim();
  if (!trimmed) return { decision: "reject", reason: "Empty content." };
  if (trimmed.length > 20_000) {
    return { decision: "reject", reason: "Content exceeds maximum length." };
  }

  const local = quickReject(trimmed);
  if (local) return { decision: "reject", reason: local };

  try {
    const out = await chatCompletionJSON<AiResponse>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Kind: ${kind}\n\nContent:\n"""\n${trimmed.slice(0, 6000)}\n"""\n\nReturn the JSON now.`,
      maxTokens: 120,
      timeoutMs: 15_000,
    });
    if (!out) {
      logger.warn({ kind }, "AI moderation offline — flagging for admin review");
      return {
        decision: "approve",
        reason: "AI moderation offline; flagged for admin review.",
        degraded: true,
      };
    }
    const decision: ModerationDecision = out.decision === "reject" ? "reject" : "approve";
    return { decision, reason: (out.reason ?? "").slice(0, 240) || "OK" };
  } catch (err) {
    logger.warn({ err, kind }, "AI moderation threw — flagging for admin review");
    return {
      decision: "approve",
      reason: "AI moderation error; flagged for admin review.",
      degraded: true,
    };
  }
}
