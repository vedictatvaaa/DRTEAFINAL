import { useMemo, useState } from "react";
import {
  useAdminMarketingStatus,
  useAdminListMarketingCampaigns,
  useAdminCreateMarketingCampaign,
  useAdminUpdateMarketingCampaign,
  useAdminDeleteMarketingCampaign,
  useAdminSendMarketingCampaign,
  useAdminMarketingDraft,
  useAdminListNewsletterSubscribers,
  useAdminListAbandonedCarts,
  useAdminListEmailLogs,
  useAdminListPushSubscriptions,
  useAdminBroadcastPush,
  getAdminListMarketingCampaignsQueryKey,
  getAdminListEmailLogsQueryKey,
  type MarketingCampaign,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Send,
  Mail,
  Bell,
  Inbox,
  ShoppingCart,
  Activity,
  Trash2,
  Save,
  TestTube2,
} from "lucide-react";

function StatTile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-serif">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export default function MarketingTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const status = useAdminMarketingStatus();
  const subs = useAdminListNewsletterSubscribers();
  const carts = useAdminListAbandonedCarts();
  const logs = useAdminListEmailLogs();
  const campaigns = useAdminListMarketingCampaigns();
  const pushSubs = useAdminListPushSubscriptions();

  const totals = useMemo(() => {
    const items = logs.data ?? [];
    return {
      sent: items.filter((l) => l.status === "sent").length,
      queued: items.filter((l) => l.status === "queued" || l.status === "skipped").length,
      failed: items.filter((l) => l.status === "failed").length,
      opens: items.filter((l) => l.openedAt).length,
      clicks: items.filter((l) => l.clickedAt).length,
    };
  }, [logs.data]);

  return (
    <div className="space-y-6">
      {!status.data?.emailEnabled ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email engine in shadow mode
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-900">
            Add a <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> in Replit Secrets to actually
            send mail. Until then, every order/welcome/newsletter is recorded in the log below as
            <em> skipped</em> so you can preview exactly what would have shipped.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Subscribers" value={subs.data?.active ?? 0} hint={`${subs.data?.total ?? 0} total`} />
        <StatTile label="Open carts" value={carts.data?.open ?? 0} hint={`${carts.data?.recovered ?? 0} recovered`} />
        <StatTile label="Push devices" value={pushSubs.data?.total ?? 0} hint={pushSubs.data?.enabled ? "VAPID set" : "VAPID missing"} />
        <StatTile label="Emails sent" value={totals.sent} hint={`${totals.failed} failed`} />
        <StatTile label="Opens / Clicks" value={`${totals.opens} / ${totals.clicks}`} />
      </div>

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Compose</TabsTrigger>
          <TabsTrigger value="campaigns"><Mail className="h-3.5 w-3.5 mr-1.5" />Campaigns</TabsTrigger>
          <TabsTrigger value="push"><Bell className="h-3.5 w-3.5 mr-1.5" />Push</TabsTrigger>
          <TabsTrigger value="logs"><Inbox className="h-3.5 w-3.5 mr-1.5" />Email log</TabsTrigger>
          <TabsTrigger value="carts"><ShoppingCart className="h-3.5 w-3.5 mr-1.5" />Carts</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4">
          <Composer onSaved={() => qc.invalidateQueries({ queryKey: getAdminListMarketingCampaignsQueryKey() })} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <CampaignsList items={campaigns.data ?? []} onChange={() => campaigns.refetch()} />
        </TabsContent>

        <TabsContent value="push" className="mt-4">
          <PushBroadcast />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Recent emails</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: getAdminListEmailLogsQueryKey() })}>Refresh</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className="text-left py-2">When</th><th className="text-left">To</th><th className="text-left">Kind</th><th className="text-left">Subject</th><th className="text-left">Status</th><th className="text-left">Open</th><th className="text-left">Click</th></tr>
                  </thead>
                  <tbody>
                    {(logs.data ?? []).slice(0, 50).map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="py-1.5 whitespace-nowrap text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                        <td className="text-xs">{l.toAddress}</td>
                        <td><Badge variant="outline" className="text-xs">{l.kind}</Badge></td>
                        <td className="text-xs">{l.subject}</td>
                        <td>
                          <Badge variant={l.status === "sent" ? "default" : l.status === "failed" ? "destructive" : "secondary"} className="text-xs">{l.status}</Badge>
                        </td>
                        <td className="text-xs">{l.openedAt ? "✓" : ""}</td>
                        <td className="text-xs">{l.clickedAt ? "✓" : ""}</td>
                      </tr>
                    ))}
                    {!logs.data?.length ? (
                      <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">No emails sent yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="carts" className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Abandoned carts</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className="text-left py-2">Email</th><th className="text-left">Items</th><th className="text-right">Subtotal</th><th className="text-left">Last seen</th><th className="text-left">Email sent</th><th className="text-left">Recovered</th></tr>
                  </thead>
                  <tbody>
                    {(carts.data?.items ?? []).map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="text-xs py-1.5">{c.email}</td>
                        <td className="text-xs">{c.items.length}</td>
                        <td className="text-xs text-right">₹{(c.subtotal / 100).toFixed(2)}</td>
                        <td className="text-xs text-muted-foreground">{new Date(c.lastSeenAt).toLocaleString()}</td>
                        <td className="text-xs">{c.emailSentAt ? "✓" : "—"}</td>
                        <td className="text-xs">{c.recoveredAt ? "✓" : "—"}</td>
                      </tr>
                    ))}
                    {!carts.data?.items.length ? (
                      <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">No abandoned carts captured yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Composer({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [tone, setTone] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Browse the new arrivals");
  const [ctaUrl, setCtaUrl] = useState("");
  const draft = useAdminMarketingDraft();
  const create = useAdminCreateMarketingCampaign();
  const send = useAdminSendMarketingCampaign();
  const [savedId, setSavedId] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const generate = async () => {
    const r = await draft.mutateAsync({ data: { topic, notes, tone, ctaLabel } });
    setSubject(r.subject);
    setPreheader(r.preheader);
    setBody(r.body);
    if (r.ctaLabel) setCtaLabel(r.ctaLabel);
    toast({ title: "Draft ready", description: "Edit it before sending." });
  };

  const saveDraft = async () => {
    if (!subject || !body) {
      toast({ title: "Subject & body required" });
      return;
    }
    const r = await create.mutateAsync({
      data: {
        channel: "email",
        subject,
        preheader,
        body,
        ctaLabel,
        ctaUrl,
        audience: "all",
        status: "draft",
      },
    });
    setSavedId(r.id);
    toast({ title: "Saved as draft", description: `Campaign #${r.id}` });
    onSaved();
  };

  const sendTest = async () => {
    if (!savedId) {
      await saveDraft();
    }
    const id = savedId ?? (await create.mutateAsync({
      data: { channel: "email", subject, preheader, body, ctaLabel, ctaUrl, audience: "all", status: "draft" },
    })).id;
    setSavedId(id);
    if (!testEmail) {
      toast({ title: "Enter a test address" });
      return;
    }
    const r = await send.mutateAsync({ id, data: { testEmail } });
    toast({ title: r.status === "test_sent" ? "Test email queued" : "Sent", description: r.emailEnabled ? "Check your inbox." : "Email engine is in shadow mode — see logs tab." });
  };

  const sendNow = async () => {
    if (!savedId) {
      const r = await create.mutateAsync({
        data: { channel: "email", subject, preheader, body, ctaLabel, ctaUrl, audience: "all", status: "draft" },
      });
      setSavedId(r.id);
      const out = await send.mutateAsync({ id: r.id, data: {} });
      toast({ title: "Sending", description: `${out.recipients ?? 0} recipients queued.` });
      onSaved();
      return;
    }
    const out = await send.mutateAsync({ id: savedId, data: {} });
    toast({ title: "Sending", description: `${out.recipients ?? 0} recipients queued.` });
    onSaved();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" />Compose newsletter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Spring rituals, autumn harvest…" />
          </div>
          <div>
            <Label className="text-xs">Tone hint</Label>
            <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="warm, literary, sensory" />
          </div>
          <div>
            <Label className="text-xs">CTA hint</Label>
            <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Browse the new arrivals" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Author notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Mention the new oolong, link to the journal piece on slow afternoons…" />
        </div>
        <div className="flex">
          <Button onClick={generate} disabled={draft.isPending} variant="secondary">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />{draft.isPending ? "Drafting…" : "AI draft"}
          </Button>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div>
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Preheader</Label>
            <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="font-serif" />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">CTA label</Label>
              <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">CTA URL</Label>
              <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://drtea.shop/shop" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-end pt-2 border-t">
          <Button variant="outline" onClick={saveDraft} disabled={create.isPending}><Save className="h-3.5 w-3.5 mr-1.5" />Save draft</Button>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Test email</Label>
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@drtea.shop" />
          </div>
          <Button variant="outline" onClick={sendTest} disabled={send.isPending}><TestTube2 className="h-3.5 w-3.5 mr-1.5" />Send test</Button>
          <Button onClick={sendNow} disabled={send.isPending}><Send className="h-3.5 w-3.5 mr-1.5" />Send to subscribers</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignsList({ items, onChange }: { items: MarketingCampaign[]; onChange: () => void }) {
  const { toast } = useToast();
  const send = useAdminSendMarketingCampaign();
  const del = useAdminDeleteMarketingCampaign();
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">All campaigns</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No campaigns yet — compose one in the Compose tab.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="text-left py-2">Subject</th><th className="text-left">Status</th><th className="text-right">Recipients</th><th className="text-right">Sent</th><th className="text-right">Opens</th><th className="text-right">Clicks</th><th className="text-left">Created</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-2 text-xs"><div className="font-medium">{c.subject}</div><div className="text-muted-foreground">{c.preheader}</div></td>
                    <td><Badge variant={c.status === "sent" ? "default" : c.status === "failed" ? "destructive" : "secondary"} className="text-xs">{c.status}</Badge></td>
                    <td className="text-right text-xs">{c.recipientsCount}</td>
                    <td className="text-right text-xs">{c.sentCount}</td>
                    <td className="text-right text-xs">{c.openCount}</td>
                    <td className="text-right text-xs">{c.clickCount}</td>
                    <td className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</td>
                    <td className="text-right">
                      {c.status === "draft" ? (
                        <Button size="sm" variant="ghost" onClick={async () => {
                          const r = await send.mutateAsync({ id: c.id, data: {} });
                          toast({ title: "Sending", description: `${r.recipients ?? 0} recipients` });
                          onChange();
                        }}><Send className="h-3.5 w-3.5" /></Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await del.mutateAsync({ id: c.id });
                        onChange();
                      }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PushBroadcast() {
  const { toast } = useToast();
  const subs = useAdminListPushSubscriptions();
  const broadcast = useAdminBroadcastPush();
  const [title, setTitle] = useState("A fresh brew is steeping");
  const [body, setBody] = useState("New small-batch arrivals are live. Tap to peek inside.");
  const [url, setUrl] = useState("/shop");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />Push broadcast</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!subs.data?.enabled ? (
          <div className="rounded-md bg-amber-50 border border-amber-300 text-amber-900 p-3 text-sm">
            Push is in shadow mode — set <code>VAPID_PUBLIC_KEY</code> and <code>VAPID_PRIVATE_KEY</code> secrets to enable. Generate with <code>npx web-push generate-vapid-keys</code>.
          </div>
        ) : null}
        <div className="text-xs text-muted-foreground">{subs.data?.total ?? 0} devices subscribed.</div>
        <div>
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Body</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        </div>
        <div>
          <Label className="text-xs">Open URL on tap</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/shop" />
        </div>
        <Button onClick={async () => {
          const r = await broadcast.mutateAsync({ data: { title, body, url } });
          toast({ title: "Broadcast complete", description: `Sent ${r.sent} · Failed ${r.failed} · Pruned ${r.pruned}` });
        }} disabled={broadcast.isPending}>
          <Send className="h-3.5 w-3.5 mr-1.5" />Broadcast now
        </Button>
      </CardContent>
    </Card>
  );
}
