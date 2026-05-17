// Bundled witty / sarcastic / romcom / inspirational / hilarious one-liners
// for the popup-nudge engine. Admin can add custom lines on top via the
// Nudges tab; runtime merges custom + bundled, filters by enabled tones &
// the active trigger, and picks one at random.

export type NudgeTone =
  | "witty"
  | "sarcastic"
  | "romcom"
  | "inspirational"
  | "hilarious";

export type NudgeTrigger =
  | "idle_browse"
  | "exit_intent"
  | "product_dwell"
  | "many_products"
  | "cart_idle"
  | "return_visit";

export type NudgeMessage = {
  id: string;
  tone: NudgeTone;
  trigger: NudgeTrigger;
  text: string;
  cta?: string;
};

export const NUDGE_LIBRARY: NudgeMessage[] = [
  // ── idle_browse ────────────────────────────────────────────────────────
  { id: "ib-w1", tone: "witty",         trigger: "idle_browse", text: "Window-shopping burns zero calories. So does buying tea. Let's go.", cta: "Show me tea" },
  { id: "ib-w2", tone: "witty",         trigger: "idle_browse", text: "Tea leaves don't get younger. Neither do you. Pick a tin.", cta: "Browse blends" },
  { id: "ib-s1", tone: "sarcastic",     trigger: "idle_browse", text: "Oh sure, keep scrolling. The kettle has nothing better to do.", cta: "Fine, take me to tea" },
  { id: "ib-s2", tone: "sarcastic",     trigger: "idle_browse", text: "Cool, another lap around the website. Your cart is feeling really validated.", cta: "End the suspense" },
  { id: "ib-r1", tone: "romcom",        trigger: "idle_browse", text: "There's a tea here that's been thinking about you. Don't make it wait.", cta: "Meet your match" },
  { id: "ib-r2", tone: "romcom",        trigger: "idle_browse", text: "Across a crowded shelf, a Darjeeling caught your eye. Go say hi.", cta: "Find it" },
  { id: "ib-i1", tone: "inspirational", trigger: "idle_browse", text: "A great cup is a small daily ritual that makes the rest of the day softer.", cta: "Build mine" },
  { id: "ib-i2", tone: "inspirational", trigger: "idle_browse", text: "Tiny pleasures, repeated, become a life worth waking up for.", cta: "Start the ritual" },
  { id: "ib-h1", tone: "hilarious",     trigger: "idle_browse", text: "Studies show: 100% of people who buy tea end up with tea. Wild stat.", cta: "Be a statistic" },
  { id: "ib-h2", tone: "hilarious",     trigger: "idle_browse", text: "Your browser history is 67% Dr Tea. The universe is sending a signal.", cta: "Obey the signal" },

  // ── exit_intent ────────────────────────────────────────────────────────
  { id: "ex-w1", tone: "witty",         trigger: "exit_intent", text: "Leaving so soon? The kettle was just getting interested.", cta: "Stay for one cup" },
  { id: "ex-w2", tone: "witty",         trigger: "exit_intent", text: "Before you go — your future self called. They want the green tea.", cta: "Help future-me" },
  { id: "ex-s1", tone: "sarcastic",     trigger: "exit_intent", text: "Sure, leave. The other tea brands will love you back, I'm sure.", cta: "Actually, wait" },
  { id: "ex-s2", tone: "sarcastic",     trigger: "exit_intent", text: "Closing the tab is bold. Almost as bold as our first-flush Assam.", cta: "Prove me wrong" },
  { id: "ex-r1", tone: "romcom",        trigger: "exit_intent", text: "Don't go yet — we were just getting to the good part.", cta: "One more look" },
  { id: "ex-r2", tone: "romcom",        trigger: "exit_intent", text: "Every great love story has a 'will they / won't they'. This is yours.", cta: "They will" },
  { id: "ex-i1", tone: "inspirational", trigger: "exit_intent", text: "The cup you don't pour today is the calm you don't get tomorrow.", cta: "Pour anyway" },
  { id: "ex-i2", tone: "inspirational", trigger: "exit_intent", text: "Small choices, made well, compound into a beautiful life.", cta: "Choose well" },
  { id: "ex-h1", tone: "hilarious",     trigger: "exit_intent", text: "Wait! I have a coupon. (I don't. But I have great tea, which is better.)", cta: "Show me the tea" },
  { id: "ex-h2", tone: "hilarious",     trigger: "exit_intent", text: "If you leave now, a chai somewhere quietly oversteeps. Don't be cruel.", cta: "Save the chai" },

  // ── product_dwell ──────────────────────────────────────────────────────
  { id: "pd-w1", tone: "witty",         trigger: "product_dwell", text: "You've been staring at this for a while. It's flattered. Add it already.", cta: "Add to cart" },
  { id: "pd-s1", tone: "sarcastic",     trigger: "product_dwell", text: "Reading the description for the third time won't change the answer. It's yes.", cta: "Say yes" },
  { id: "pd-r1", tone: "romcom",        trigger: "product_dwell", text: "Some things you keep coming back to for a reason. This is one of them.", cta: "Take it home" },
  { id: "pd-i1", tone: "inspirational", trigger: "product_dwell", text: "Trust your instincts — they brought you here for a reason.", cta: "Add to cart" },
  { id: "pd-h1", tone: "hilarious",     trigger: "product_dwell", text: "Your cursor is doing laps around this product. Just put it in the cart, champ.", cta: "Cart it" },
  { id: "pd-w2", tone: "witty",         trigger: "product_dwell", text: "Indecision burns more calories than tea. Both end with you holding a cup.", cta: "Hold the cup" },

  // ── many_products ──────────────────────────────────────────────────────
  { id: "mp-w1", tone: "witty",         trigger: "many_products", text: "You've inspected half the shop. The other half is jealous. Pick one.", cta: "Pick a winner" },
  { id: "mp-s1", tone: "sarcastic",     trigger: "many_products", text: "We get it — you have standards. Bold of you to think we don't meet them.", cta: "Test the theory" },
  { id: "mp-r1", tone: "romcom",        trigger: "many_products", text: "All these blends, and you keep coming back to your favourite. That's love.", cta: "Commit" },
  { id: "mp-i1", tone: "inspirational", trigger: "many_products", text: "You don't need the perfect tea. You need the one you'll actually brew.", cta: "Brew this one" },
  { id: "mp-h1", tone: "hilarious",     trigger: "many_products", text: "Tea Olympics: gold medal in browsing, no medal yet in drinking. Let's fix that.", cta: "Win gold" },
  { id: "mp-w2", tone: "witty",         trigger: "many_products", text: "If you ranked these blends by 'almost added to cart', you'd have a podium by now.", cta: "Crown a winner" },

  // ── cart_idle ──────────────────────────────────────────────────────────
  { id: "ci-w1", tone: "witty",         trigger: "cart_idle", text: "Your cart has feelings. Right now, they're abandonment issues.", cta: "Checkout" },
  { id: "ci-s1", tone: "sarcastic",     trigger: "cart_idle", text: "Leaving things in carts is a personality. Bold choice. Checkout would be bolder.", cta: "Be bolder" },
  { id: "ci-r1", tone: "romcom",        trigger: "cart_idle", text: "You added it. It said yes. Don't ghost the kettle now.", cta: "Make it official" },
  { id: "ci-i1", tone: "inspirational", trigger: "cart_idle", text: "Action turns intention into ritual. One click, one cup, one calmer week.", cta: "One click" },
  { id: "ci-h1", tone: "hilarious",     trigger: "cart_idle", text: "Your cart is doing yoga to stay relaxed. Help it out — finish checkout.", cta: "Checkout" },
  { id: "ci-w2", tone: "witty",         trigger: "cart_idle", text: "Tea in cart: ready. Postman: ready. You: distracted by a meme, probably.", cta: "Focus, friend" },

  // ── return_visit ───────────────────────────────────────────────────────
  { id: "rv-w1", tone: "witty",         trigger: "return_visit", text: "Back again? The shop missed you. The tea is louder about it.", cta: "Welcome back" },
  { id: "rv-s1", tone: "sarcastic",     trigger: "return_visit", text: "Oh, you're back. Did the other websites disappoint? Shocker.", cta: "Make it count" },
  { id: "rv-r1", tone: "romcom",        trigger: "return_visit", text: "We had a feeling you'd come back. We kept the kettle warm.", cta: "Pick up where we left off" },
  { id: "rv-i1", tone: "inspirational", trigger: "return_visit", text: "Coming back is the first half of starting. The second half is one click.", cta: "Click the second half" },
  { id: "rv-h1", tone: "hilarious",     trigger: "return_visit", text: "Welcome back! Your previous browsing session is still in therapy.", cta: "Help it heal" },
];

export function pickNudge(
  trigger: NudgeTrigger,
  allowedTones: NudgeTone[],
  extras: NudgeMessage[],
  recentlyShownIds: string[],
): NudgeMessage | null {
  const pool = [...NUDGE_LIBRARY, ...extras].filter(
    (m) =>
      m.trigger === trigger &&
      (allowedTones.length === 0 || allowedTones.includes(m.tone)) &&
      !recentlyShownIds.includes(m.id),
  );
  if (!pool.length) {
    // Recycle if every line was recently shown.
    const recycle = [...NUDGE_LIBRARY, ...extras].filter(
      (m) =>
        m.trigger === trigger &&
        (allowedTones.length === 0 || allowedTones.includes(m.tone)),
    );
    if (!recycle.length) return null;
    return recycle[Math.floor(Math.random() * recycle.length)]!;
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}
