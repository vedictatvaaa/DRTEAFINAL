import { useState, type FormEvent } from 'react';
import { Check, Loader2, Mail } from 'lucide-react';

export default function InlineNewsletter({
  topic,
  variant = 'inline',
}: {
  topic: string;
  variant?: 'inline' | 'card';
}) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: `journal:${topic}` }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Could not subscribe.');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not subscribe.');
    } finally {
      setSubmitting(false);
    }
  }

  const label = `More on ${topic}`;
  const isCard = variant === 'card';

  if (done) {
    return (
      <div
        className={
          isCard
            ? 'rounded-2xl bg-[#1a2416] text-white p-6 sm:p-7 text-center'
            : 'rounded-xl border border-green-600/20 bg-green-50 px-5 py-4 my-8 not-prose'
        }
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${
            isCard ? 'bg-amber-200 text-[#1a2416]' : 'bg-green-600 text-white'
          }`}
        >
          <Check className="w-5 h-5" strokeWidth={3} />
        </div>
        <p className={`text-[14px] font-semibold ${isCard ? 'text-white' : 'text-green-900'}`}>
          You’re on the list.
        </p>
        <p className={`text-[12px] mt-1 ${isCard ? 'text-white/65' : 'text-green-800/80'}`}>
          We’ll send you new {topic} stories as they go live.
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        isCard
          ? 'rounded-2xl bg-[#1a2416] text-white p-6 sm:p-7'
          : 'rounded-xl border border-primary/20 bg-primary/5 px-5 py-5 my-8 not-prose'
      }
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Mail className={`w-4 h-4 ${isCard ? 'text-amber-200' : 'text-primary'}`} />
        <p
          className={`text-[10px] uppercase tracking-[0.25em] font-bold ${
            isCard ? 'text-amber-200' : 'text-primary'
          }`}
        >
          {label}
        </p>
      </div>
      <h3
        className={`font-serif text-[18px] sm:text-[20px] leading-snug mb-1 ${
          isCard ? 'text-white' : 'text-foreground'
        }`}
      >
        Get more {topic} stories in your inbox.
      </h3>
      <p className={`text-[12.5px] mb-4 ${isCard ? 'text-white/65' : 'text-muted-foreground'}`}>
        One curated email a week. Unsubscribe in one click.
      </p>
      <form onSubmit={handle} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className={`flex-1 px-3.5 py-2.5 rounded-md text-[13px] focus:outline-none focus:ring-2 ${
            isCard
              ? 'bg-white/[0.08] border border-white/15 text-white placeholder:text-white/40 focus:ring-amber-200/40 focus:border-amber-200/40'
              : 'bg-white border border-border text-foreground placeholder:text-muted-foreground focus:ring-primary/30 focus:border-primary/40'
          }`}
        />
        <button
          type="submit"
          disabled={submitting}
          className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-[12px] font-bold uppercase tracking-widest transition-colors disabled:opacity-60 ${
            isCard
              ? 'bg-amber-200 text-[#1a2416] hover:bg-amber-100'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
        </button>
      </form>
      {error && (
        <p className={`text-[11px] mt-2 ${isCard ? 'text-red-200' : 'text-red-600'}`}>{error}</p>
      )}
    </div>
  );
}
