import { useState } from 'react';
import { motion } from 'framer-motion';
import { Repeat, Pause, Play, SkipForward, X, Loader2, Calendar, Package as PackageIcon } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, type CurrencyCode } from '@/lib/currency';
import {
  useMySubscriptions,
  pauseSubscription,
  resumeSubscription,
  skipSubscription,
  cancelSubscription,
  updateSubscriptionFrequency,
  type Subscription,
} from '@/lib/subscriptions';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_BADGE: Record<Subscription['status'], string> = {
  active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  paused: 'bg-amber-50 text-amber-800 border-amber-200',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

export default function SubscriptionsPanel({ enabled }: { enabled: boolean }) {
  const { data, config, loading, error, refetch } = useMySubscriptions(enabled);
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);

  if (!enabled) {
    return (
      <div className="border border-border rounded text-center py-20 px-6">
        <Repeat className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground mb-1">Sign in to manage your tea ritual.</p>
        <p className="text-[12px] text-muted-foreground mb-5">
          Subscribe to any blend at checkout to start a recurring delivery.
        </p>
        <Link href="/rewards" className="text-sm uppercase tracking-widest font-medium text-primary hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="border border-border rounded p-5 animate-pulse h-32 bg-muted/20" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded p-4 text-sm">
        Could not load your subscriptions: {error}.
      </div>
    );
  }

  const subs = data ?? [];

  if (subs.length === 0) {
    return (
      <div className="border border-border rounded text-center py-20 px-6">
        <Repeat className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground mb-1">No active subscriptions yet.</p>
        <p className="text-[12px] text-muted-foreground mb-5">
          Tick "Subscribe & Save 50%" on any product to set up a recurring delivery.
        </p>
        <Link href="/shop" className="text-sm uppercase tracking-widest font-medium text-primary hover:underline">
          Browse teas
        </Link>
      </div>
    );
  }

  const run = async (id: number, fn: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    try {
      await fn();
      await refetch();
      toast({ title: success });
    } catch (e) {
      toast({ title: 'Could not complete that action', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#FAF8F4] border border-border rounded p-4 text-[12.5px] text-muted-foreground flex items-start gap-3">
        <Repeat className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p>
          A 10% discount is automatically applied at checkout for every subscribed item.
          Skip a delivery, change cadence, or cancel anytime — no questions asked.
        </p>
      </div>

      {subs.map((s) => {
        const isBusy = busyId === s.id;
        const linePrice = Math.round(s.unitPrice * (1 - s.discountPct / 100)) * s.quantity;
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border border-border rounded p-5 sm:p-6 ${s.status === 'cancelled' ? 'opacity-60' : ''}`}
            data-testid={`subscription-row-${s.id}`}
          >
            <div className="flex flex-wrap items-start gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-sm border ${STATUS_BADGE[s.status]}`}
                  >
                    {s.status}
                  </span>
                </div>
                <h3 className="font-serif font-semibold text-lg leading-tight">{s.productName}</h3>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">
                  {s.variantSize} · qty {s.quantity} · every {s.frequencyWeeks} weeks
                </p>
              </div>
              <div className="text-right">
                <p className="font-serif font-semibold text-lg">{formatPrice(linePrice, s.currency as CurrencyCode)}</p>
                <p className="text-[11px] text-muted-foreground">per delivery</p>
              </div>
            </div>

            {s.status !== 'cancelled' && (
              <div className="flex items-center gap-2 text-[13px] text-foreground/80 mb-4 bg-muted/40 px-3 py-2 rounded-sm">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>
                  {s.status === 'paused' ? 'Paused.' : 'Next delivery'}{' '}
                  {s.status === 'active' && (
                    <span className="font-semibold text-foreground">{formatDate(s.nextDeliveryAt)}</span>
                  )}
                </span>
              </div>
            )}

            {s.status !== 'cancelled' && (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-4">
                {s.status === 'active' ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => run(s.id, () => pauseSubscription(s.id), 'Subscription paused')}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-sm border border-border bg-white text-[11.5px] uppercase tracking-widest font-bold hover:bg-muted disabled:opacity-50"
                    data-testid={`button-pause-${s.id}`}
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => run(s.id, () => resumeSubscription(s.id), 'Subscription resumed')}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-sm border border-emerald-300 bg-emerald-50 text-emerald-900 text-[11.5px] uppercase tracking-widest font-bold hover:bg-emerald-100 disabled:opacity-50"
                    data-testid={`button-resume-${s.id}`}
                  >
                    <Play className="w-3.5 h-3.5" /> Resume
                  </button>
                )}
                <button
                  type="button"
                  disabled={isBusy || s.status !== 'active'}
                  onClick={() => run(s.id, () => skipSubscription(s.id), 'Next delivery skipped')}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-sm border border-border bg-white text-[11.5px] uppercase tracking-widest font-bold hover:bg-muted disabled:opacity-30"
                  data-testid={`button-skip-${s.id}`}
                >
                  <SkipForward className="w-3.5 h-3.5" /> Skip next
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    if (window.confirm('Cancel this subscription? You can resubscribe at any time.')) {
                      void run(s.id, () => cancelSubscription(s.id), 'Subscription cancelled');
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-sm border border-destructive/30 text-destructive text-[11.5px] uppercase tracking-widest font-bold hover:bg-destructive/10 disabled:opacity-50"
                  data-testid={`button-cancel-${s.id}`}
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            )}

            {s.status !== 'cancelled' && config && (
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <label className="text-muted-foreground">Cadence:</label>
                <select
                  value={s.frequencyWeeks}
                  disabled={isBusy}
                  onChange={(e) =>
                    void run(
                      s.id,
                      () => updateSubscriptionFrequency(s.id, Number(e.target.value)),
                      'Cadence updated',
                    )
                  }
                  className="border border-border bg-white rounded-sm px-2 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                  data-testid={`select-frequency-${s.id}`}
                >
                  {config.frequencies.map((f) => (
                    <option key={f} value={f}>
                      Every {f} weeks
                    </option>
                  ))}
                </select>
                {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>
            )}

            {s.status === 'cancelled' && (
              <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <PackageIcon className="w-3.5 h-3.5" /> This subscription is cancelled. Resubscribe by ordering this tea again.
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
