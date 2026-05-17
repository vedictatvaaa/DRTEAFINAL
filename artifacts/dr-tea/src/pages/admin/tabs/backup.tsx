import { useMemo, useState } from "react";
import {
  useAdminListSnapshots,
  useAdminCreateSnapshot,
  useAdminRestoreSnapshot,
  useAdminListRecentVersions,
  useAdminListEntityVersions,
  useAdminRevertVersion,
  getAdminListSnapshotsQueryKey,
  getAdminListRecentVersionsQueryKey,
  getAdminListEntityVersionsQueryKey,
  type Snapshot,
  type EntityVersion,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(s: string | Date): string {
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleString();
}

function rowCountTotal(rc: Record<string, number> | null | undefined): number {
  if (!rc) return 0;
  return Object.values(rc).reduce((a, b) => a + b, 0);
}

export default function BackupTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [snapshotKind, setSnapshotKind] = useState<"daily" | "manual">("daily");
  const snapshots = useAdminListSnapshots({ kind: snapshotKind });
  const recentVersions = useAdminListRecentVersions();
  const createSnap = useAdminCreateSnapshot();
  const restoreSnap = useAdminRestoreSnapshot();
  const revert = useAdminRevertVersion();

  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [diffVersion, setDiffVersion] = useState<EntityVersion | null>(null);

  const [historyEntity, setHistoryEntity] = useState<{
    type: "product" | "article" | "experience";
    id: string;
  } | null>(null);

  async function handleBackupNow() {
    try {
      await createSnap.mutateAsync();
      await qc.invalidateQueries({ queryKey: getAdminListSnapshotsQueryKey() });
      toast({ title: "Snapshot created", description: "A fresh backup is now in object storage." });
    } catch (err) {
      toast({
        title: "Snapshot failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    if (confirmCode !== restoreTarget.id) {
      toast({
        title: "Confirmation mismatch",
        description: "Type the snapshot id exactly to confirm.",
        variant: "destructive",
      });
      return;
    }
    try {
      const result = await restoreSnap.mutateAsync({
        id: restoreTarget.id,
        data: { confirm: restoreTarget.id },
      });
      const total = rowCountTotal(result.restored);
      toast({
        title: "Snapshot restored",
        description: `${total} rows restored from ${restoreTarget.id.slice(0, 8)}.`,
      });
      setRestoreTarget(null);
      setConfirmCode("");
      await qc.invalidateQueries();
    } catch (err) {
      toast({
        title: "Restore failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleRevert(v: EntityVersion) {
    try {
      const result = await revert.mutateAsync({ id: v.id });
      toast({
        title: "Version reverted",
        description: `${result.entityType} ${result.entityId} → ${result.outcome}`,
      });
      await qc.invalidateQueries({ queryKey: getAdminListRecentVersionsQueryKey() });
      if (historyEntity) {
        await qc.invalidateQueries({
          queryKey: getAdminListEntityVersionsQueryKey(historyEntity.type, historyEntity.id),
        });
      }
    } catch (err) {
      toast({
        title: "Revert failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Backups & version history</h2>
          <p className="text-sm text-muted-foreground">
            Daily database snapshots are stored in private object storage. The 14 most recent
            successful snapshots are retained.
          </p>
        </div>
        <Button onClick={handleBackupNow} disabled={createSnap.isPending}>
          {createSnap.isPending ? "Creating…" : "Backup now"}
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-2">
          <h3 className="font-medium">Snapshots</h3>
          <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
            <button
              type="button"
              className={`px-3 py-1 rounded ${snapshotKind === "daily" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setSnapshotKind("daily")}
            >
              Daily history (last 14)
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded ${snapshotKind === "manual" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setSnapshotKind("manual")}
            >
              Manual
            </button>
          </div>
        </div>
        {snapshots.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (snapshots.data ?? []).length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No snapshots yet. Create one with “Backup now” or wait for the daily job.
          </div>
        ) : (
          <ul className="divide-y">
            {(snapshots.data ?? []).map((s) => (
              <li key={s.id} className="p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-medium text-sm">
                    {formatDate(s.createdAt)}{" "}
                    <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                      {s.kind}
                    </span>
                    {s.status === "failed" && (
                      <span className="ml-2 text-xs text-red-600">failed</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{s.id}</div>
                  {s.errorMessage && (
                    <div className="text-xs text-red-600 mt-1">{s.errorMessage}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground min-w-[8rem]">
                  {rowCountTotal(s.rowCounts)} rows · {formatBytes(s.sizeBytes)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={s.status !== "ready"}
                  onClick={() => {
                    setRestoreTarget(s);
                    setConfirmCode("");
                  }}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="font-medium">Recent edits</h3>
          <p className="text-xs text-muted-foreground">
            Per-entity history retains the last 20 versions.
          </p>
        </div>
        {recentVersions.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (recentVersions.data ?? []).length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No edits recorded yet. Make changes in Products, Journal, or Experience to populate the
            history.
          </div>
        ) : (
          <ul className="divide-y">
            {(recentVersions.data ?? []).slice(0, 30).map((v) => (
              <li key={v.id} className="p-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex-1 min-w-[14rem]">
                  <div className="font-medium">
                    <span className="capitalize">{v.entityType}</span>{" "}
                    <span className="text-xs text-muted-foreground">#{v.entityId}</span>{" "}
                    <span className="ml-2 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                      {v.action}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setHistoryEntity({
                      type: v.entityType as "product" | "article" | "experience",
                      id: v.entityId,
                    })
                  }
                >
                  History
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDiffVersion(v)}>
                  View diff
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevert(v)}
                  disabled={revert.isPending}
                >
                  Revert
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RestoreDialog
        snapshot={restoreTarget}
        confirmCode={confirmCode}
        onConfirmCodeChange={setConfirmCode}
        onCancel={() => {
          setRestoreTarget(null);
          setConfirmCode("");
        }}
        onConfirm={handleRestore}
        pending={restoreSnap.isPending}
      />

      <DiffDialog version={diffVersion} onClose={() => setDiffVersion(null)} />

      {historyEntity && (
        <EntityHistoryDialog
          target={historyEntity}
          onClose={() => setHistoryEntity(null)}
          onRevert={handleRevert}
          onViewDiff={(v) => setDiffVersion(v)}
          reverting={revert.isPending}
        />
      )}
    </div>
  );
}

function RestoreDialog({
  snapshot,
  confirmCode,
  onConfirmCodeChange,
  onCancel,
  onConfirm,
  pending,
}: {
  snapshot: Snapshot | null;
  confirmCode: string;
  onConfirmCodeChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={!!snapshot} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore snapshot</DialogTitle>
          <DialogDescription>
            This will <strong>overwrite</strong> all products, articles, orders, and experiences
            with the snapshot’s contents. Existing version history will be cleared.
          </DialogDescription>
        </DialogHeader>
        {snapshot && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="font-mono text-xs break-all">{snapshot.id}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatDate(snapshot.createdAt)} · {rowCountTotal(snapshot.rowCounts)} rows ·{" "}
                {formatBytes(snapshot.sizeBytes)}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-code">Type the snapshot id to confirm</Label>
              <Input
                id="confirm-code"
                value={confirmCode}
                onChange={(e) => onConfirmCodeChange(e.target.value)}
                placeholder={snapshot.id}
                autoFocus
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending || !snapshot || confirmCode !== snapshot.id}
          >
            {pending ? "Restoring…" : "Restore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffDialog({
  version,
  onClose,
}: {
  version: EntityVersion | null;
  onClose: () => void;
}) {
  const before = useMemo(
    () => (version ? JSON.stringify(version.before ?? null, null, 2) : ""),
    [version],
  );
  const after = useMemo(
    () => (version ? JSON.stringify(version.after ?? null, null, 2) : ""),
    [version],
  );
  return (
    <Dialog open={!!version} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {version
              ? `${version.entityType} #${version.entityId} — ${version.action}`
              : "Version diff"}
          </DialogTitle>
          {version && (
            <DialogDescription>{formatDate(version.createdAt)}</DialogDescription>
          )}
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2 text-xs">
          <div>
            <div className="font-medium mb-1">Before</div>
            <Textarea
              value={before}
              readOnly
              className="font-mono h-80 resize-none"
            />
          </div>
          <div>
            <div className="font-medium mb-1">After</div>
            <Textarea
              value={after}
              readOnly
              className="font-mono h-80 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntityHistoryDialog({
  target,
  onClose,
  onRevert,
  onViewDiff,
  reverting,
}: {
  target: { type: "product" | "article" | "experience"; id: string };
  onClose: () => void;
  onRevert: (v: EntityVersion) => void;
  onViewDiff: (v: EntityVersion) => void;
  reverting: boolean;
}) {
  const versions = useAdminListEntityVersions(target.type, target.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {target.type} #{target.id} — version history
          </DialogTitle>
          <DialogDescription>
            Last 20 changes. Reverting writes a new version capturing the rollback.
          </DialogDescription>
        </DialogHeader>
        {versions.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (versions.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">No history for this entity.</div>
        ) : (
          <ul className="divide-y max-h-[60vh] overflow-y-auto">
            {(versions.data ?? []).map((v) => (
              <li key={v.id} className="py-2.5 flex flex-wrap items-center gap-2 text-sm">
                <div className="flex-1 min-w-[10rem]">
                  <div className="font-medium capitalize">{v.action}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onViewDiff(v)}>
                  Diff
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reverting}
                  onClick={() => onRevert(v)}
                >
                  Revert
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
