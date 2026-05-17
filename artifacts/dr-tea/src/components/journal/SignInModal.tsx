import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { requestShopperOtp, verifyShopperOtp } from "@/lib/shopper-auth";

export default function SignInModal({
  open,
  onOpenChange,
  onSignedIn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSignedIn?: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();

  async function send() {
    if (!email.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const r = await requestShopperOtp(email.trim().toLowerCase(), name.trim());
      setDevCode(r.devCode);
      setStep("code");
      toast({
        title: "Code sent",
        description: r.devCode
          ? `Dev mode: your code is ${r.devCode}`
          : "Check your inbox for a 6-digit code.",
      });
    } catch (err) {
      toast({
        title: "Couldn't send code",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await verifyShopperOtp(email.trim().toLowerCase(), code, name.trim());
      toast({ title: "Welcome to the Journal" });
      onSignedIn?.();
      onOpenChange(false);
      setStep("email");
      setCode("");
    } catch (err) {
      toast({
        title: "Couldn't sign you in",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            Join the Journal
          </DialogTitle>
          <DialogDescription>
            Sign in with your email to share your tea stories and join the
            conversation.
          </DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                Your name (optional)
              </label>
              <Input
                placeholder="e.g. Anya"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={send} disabled={busy}>
              {busy ? "Sending…" : "Send me a 6-digit code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We sent a code to <span className="font-medium">{email}</span>.
              {devCode ? (
                <span className="block mt-1 text-xs text-amber-700">
                  Dev mode code: <code className="font-mono">{devCode}</code>
                </span>
              ) : null}
            </p>
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="tracking-[0.5em] text-center text-lg font-mono"
            />
            <Button className="w-full" onClick={verify} disabled={busy}>
              {busy ? "Verifying…" : "Sign in"}
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
              onClick={() => setStep("email")}
            >
              Use a different email
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
