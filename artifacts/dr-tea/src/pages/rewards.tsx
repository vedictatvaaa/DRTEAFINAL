import { useState } from 'react';
import { Link } from 'wouter';
import { Sparkles, Gift, Coins, Mail, ShoppingBag, Loader2 } from 'lucide-react';
import { useShopper } from '@/lib/shopper-auth';
import { useLoyalty } from '@/lib/loyalty';
import { formatPrice } from '@/lib/currency';
import { useStore } from '@/store/use-store';
import Seo from '@/components/Seo';
import SignInModal from '@/components/journal/SignInModal';
import { Button } from '@/components/ui/button';

export default function Rewards() {
  const { user, isLoading: shopperLoading } = useShopper();
  const isSignedIn = !!user;
  const { data, isLoading } = useLoyalty(isSignedIn);
  const currency = useStore((s) => s.currency);
  const [signInOpen, setSignInOpen] = useState(false);

  const balance = data?.account.pointsBalance ?? 0;
  const lifetime = data?.account.lifetimePoints ?? 0;
  const rupeesPerPoint = data?.config.rupeesPerPointRedeem ?? 0.5;
  const redeemValueRupees = Math.floor(balance * rupeesPerPoint);

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Seo
        title="Tea Club Rewards — Earn & Redeem with Dr Tea"
        description="Earn 1 point for every ₹10 spent at Dr Tea. Redeem points for instant discounts at checkout. Tea Club is free for everyone."
        canonical="https://drtea.in/rewards"
      />

      {/* Hero */}
      <section className="relative bg-[#1a2416] text-white">
        <div className="container mx-auto px-4 sm:px-6 py-14 sm:py-20 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-10 items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200 font-bold mb-3">Tea Club</p>
              <h1 className="font-serif font-bold text-4xl sm:text-5xl leading-tight mb-4">
                Earn points with every cup.
              </h1>
              <p className="text-white/75 text-base sm:text-lg leading-relaxed max-w-xl mb-6">
                Tea Club is our way of saying thank you. Earn a point for every ₹10 you spend, and
                redeem them at checkout for instant discounts on your favourite blends.
              </p>
              {isSignedIn ? (
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-amber-200 text-[#1a2416] rounded-md font-bold uppercase tracking-widest text-[12px] hover:bg-amber-100 transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" /> Shop & earn more
                </Link>
              ) : (
                <Button
                  onClick={() => setSignInOpen(true)}
                  className="bg-amber-200 text-[#1a2416] hover:bg-amber-100 gap-2"
                >
                  <Mail className="w-4 h-4" /> Join Tea Club — it’s free
                </Button>
              )}
            </div>

            {/* Balance card */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-6">
              {!isSignedIn || shopperLoading ? (
                <div className="text-center py-4">
                  <Coins className="w-8 h-8 text-amber-200 mx-auto mb-3 opacity-70" />
                  <p className="text-[12px] uppercase tracking-widest text-amber-200/80 font-bold mb-1">
                    Your Balance
                  </p>
                  <p className="text-3xl font-serif font-bold text-white mb-1">— pts</p>
                  <p className="text-[11px] text-white/55">
                    Sign in to see your points.
                  </p>
                </div>
              ) : isLoading || !data ? (
                <div className="text-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-200 mx-auto" />
                </div>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-amber-200 font-bold mb-2">
                    Your Balance
                  </p>
                  <p className="text-4xl font-serif font-bold text-white leading-none">
                    {balance.toLocaleString('en-IN')}
                    <span className="text-base text-white/55 font-sans font-normal ml-1.5">pts</span>
                  </p>
                  <p className="text-[12px] text-white/65 mt-2 mb-4">
                    Worth <span className="text-amber-200 font-semibold">{formatPrice(redeemValueRupees, currency)}</span> at checkout
                  </p>
                  <div className="text-[11px] text-white/55 pt-3 border-t border-white/10 flex justify-between">
                    <span>Lifetime points</span>
                    <span className="text-white font-semibold">{lifetime.toLocaleString('en-IN')}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 sm:px-6 py-14 sm:py-20 max-w-5xl">
        <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold mb-3 text-center">
          How it works
        </p>
        <h2 className="font-serif font-bold text-3xl sm:text-4xl text-center mb-12 leading-tight">
          Three steps from leaf to discount.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {[
            {
              num: '01',
              icon: Mail,
              title: 'Join free',
              body: 'Sign in with your email — no password, no fees, no hidden tiers.',
            },
            {
              num: '02',
              icon: ShoppingBag,
              title: 'Earn 1 point per ₹10',
              body: 'Every paid order earns points automatically. Subscriptions and Reserve teas count too.',
            },
            {
              num: '03',
              icon: Gift,
              title: 'Redeem at checkout',
              body: '100 points = ₹50 off. Apply at checkout, up to half your cart subtotal.',
            },
          ].map((step) => (
            <div
              key={step.num}
              className="relative bg-white rounded-2xl border border-border p-7 overflow-hidden"
            >
              <span
                aria-hidden="true"
                className="absolute -top-2 -right-1 font-serif italic text-[68px] leading-none text-primary/[0.07] select-none"
              >
                {step.num}
              </span>
              <div className="w-11 h-11 rounded-full bg-amber-100 text-[#1a2416] flex items-center justify-center mb-4">
                <step.icon className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-semibold text-xl mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      {isSignedIn && data && (
        <section className="container mx-auto px-4 sm:px-6 pb-16 max-w-5xl">
          <h2 className="font-serif font-bold text-2xl sm:text-3xl mb-6 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" /> Recent activity
          </h2>
          {data.ledger.length === 0 ? (
            <div className="text-center py-12 bg-white border border-border rounded-2xl">
              <Coins className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                You haven’t earned any points yet — your first order will count.
              </p>
              <Link
                href="/shop"
                className="text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
              >
                Start shopping →
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <ul className="divide-y divide-border">
                {data.ledger.map((entry) => {
                  const isCredit = entry.points > 0;
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-foreground truncate">
                          {entry.note ||
                            (entry.kind === 'earn'
                              ? 'Points earned'
                              : entry.kind === 'redeem'
                              ? 'Points redeemed'
                              : 'Adjustment')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                          {entry.orderId ? ` · Order #${entry.orderId}` : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-mono font-semibold tabular-nums text-sm ${
                          isCredit ? 'text-[#3a5a2c]' : 'text-amber-700'
                        }`}
                      >
                        {isCredit ? '+' : ''}{entry.points.toLocaleString('en-IN')} pts
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  );
}
