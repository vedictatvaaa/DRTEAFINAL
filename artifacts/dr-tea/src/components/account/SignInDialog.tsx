import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useStore } from '@/store/use-store';
import { useShopper, requestShopperOtp, verifyShopperOtp } from '@/lib/shopper-auth';
import { useToast } from '@/hooks/use-toast';

type Step = 'email' | 'code';

export default function SignInDialog() {
  const open = useStore((s) => s.isSignInOpen);
  const closeSignIn = useStore((s) => s.closeSignIn);
  const { user, refetch } = useShopper();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('email');
    setCode('');
    setError(null);
    setDevCode(null);
    setBusy(false);
    const id = window.setTimeout(() => emailRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (step === 'code') {
      const id = window.setTimeout(() => codeRef.current?.focus(), 80);
      return () => window.clearTimeout(id);
    }
  }, [step]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSignIn(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeSignIn]);

  // If already logged in, close
  useEffect(() => {
    if (open && user) closeSignIn();
  }, [open, user, closeSignIn]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await requestShopperOtp(email.trim(), name.trim() || undefined);
      setDevCode(res.devCode ?? null);
      setStep('code');
      toast({
        title: 'Check your inbox',
        description: `We sent a 6-digit code to ${email.trim()}.`,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 4) {
      setError('Enter the code we emailed you.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const u = await verifyShopperOtp(email.trim(), code.trim(), name.trim() || undefined);
      await refetch();
      toast({
        title: `Welcome${u.name ? `, ${u.name.split(' ')[0]}` : ''}`,
        description: 'You\u2019re signed in. Your rituals are ready.',
      });
      closeSignIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSignIn}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed left-1/2 top-1/2 z-[81] w-[min(94vw,420px)] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative bg-white rounded-xl shadow-[0_24px_60px_-20px_rgba(26,36,22,0.4)] border border-[#1a2416]/8 overflow-hidden">
              <button
                onClick={closeSignIn}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[#1a2416]/50 hover:text-[#1a2416] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
                aria-label="Close sign-in"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="px-6 pt-7 pb-4 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#1a2416] text-amber-100 mb-3">
                  {step === 'email' ? <Mail className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                </div>
                <h2 id="signin-title" className="text-xl font-serif font-medium text-[#1a2416]">
                  {step === 'email' ? 'Sign in to Dr Tea' : 'Enter your code'}
                </h2>
                <p className="text-[12px] text-[#1a2416]/55 mt-1 leading-snug">
                  {step === 'email'
                    ? 'We\u2019ll email you a one-time code. No password needed.'
                    : `Sent to ${email}. Code expires in 10 minutes.`}
                </p>
              </div>

              {/* Body */}
              <div className="px-6 pb-6">
                {step === 'email' && (
                  <form onSubmit={handleRequest} className="space-y-3">
                    <div>
                      <label htmlFor="signin-email" className="sr-only">Email</label>
                      <input
                        ref={emailRef}
                        id="signin-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-3 border border-[#1a2416]/15 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus:border-[#3a5a2c] bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="signin-name" className="sr-only">Name (optional)</label>
                      <input
                        id="signin-name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name (optional)"
                        className="w-full px-3.5 py-3 border border-[#1a2416]/15 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus:border-[#3a5a2c] bg-white"
                      />
                    </div>
                    {error && (
                      <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-md">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#1a2416] text-white text-[12px] uppercase tracking-[0.18em] font-semibold rounded-md hover:bg-[#0f1810] transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-2"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {busy ? 'Sending…' : 'Email me a code'}
                    </button>
                    <p className="text-[10px] text-[#1a2416]/45 text-center leading-snug pt-1">
                      By continuing you agree to our{' '}
                      <a href="/terms" className="underline hover:text-[#1a2416]/70">Terms</a>{' '}
                      and{' '}
                      <a href="/privacy" className="underline hover:text-[#1a2416]/70">Privacy Policy</a>.
                    </p>
                  </form>
                )}

                {step === 'code' && (
                  <form onSubmit={handleVerify} className="space-y-3">
                    <div>
                      <label htmlFor="signin-code" className="sr-only">6-digit code</label>
                      <input
                        ref={codeRef}
                        id="signin-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="• • • • • •"
                        className="w-full px-3.5 py-3 border border-[#1a2416]/15 rounded-md text-center text-2xl tracking-[0.5em] font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus:border-[#3a5a2c] bg-white"
                      />
                    </div>
                    {devCode && (
                      <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-md">
                        Dev mode — your code is <span className="font-mono font-bold">{devCode}</span>
                      </p>
                    )}
                    {error && (
                      <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-md">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={busy || code.length < 4}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#1a2416] text-white text-[12px] uppercase tracking-[0.18em] font-semibold rounded-md hover:bg-[#0f1810] transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c] focus-visible:ring-offset-2"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      {busy ? 'Verifying…' : 'Verify & sign in'}
                    </button>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => { setStep('email'); setError(null); setCode(''); }}
                        className="text-[11px] text-[#1a2416]/55 hover:text-[#1a2416] underline"
                      >
                        Use a different email
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError(null);
                          try {
                            const res = await requestShopperOtp(email.trim(), name.trim() || undefined);
                            setDevCode(res.devCode ?? null);
                            toast({ title: 'New code sent', description: `Check ${email.trim()}.` });
                          } catch (err) {
                            setError((err as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="text-[11px] text-[#3a5a2c] hover:underline disabled:opacity-60"
                      >
                        Resend code
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
