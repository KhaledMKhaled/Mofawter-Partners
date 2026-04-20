import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, CheckCircle2, Clock, XCircle, Eye, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useListCommissions } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/format";


// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, t }: { status: string, t: any }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    DRAFT:     { label: t.common.statusDraft ?? "Draft",     className: "bg-slate-100 text-slate-700 border-slate-200",       icon: <Clock className="me-1 h-3 w-3" /> },
    CONFIRMED: { label: t.common.statusConfirmed ?? "Confirmed", className: "bg-emerald-50 text-emerald-700 border-emerald-200",  icon: <CheckCircle2 className="me-1 h-3 w-3" /> },
    CANCELLED: { label: t.common.statusCancelled ?? "Cancelled", className: "bg-red-50 text-red-700 border-red-200",             icon: <XCircle className="me-1 h-3 w-3" /> },
  };
  const s = map[status] ?? { label: status, className: "", icon: null };
  return (
    <Badge variant="outline" className={`flex items-center w-fit ${s.className}`}>
      {s.icon}{s.label}
    </Badge>
  );
}

type Batch = {
  id: number;
  beneficiaryType: string;
  beneficiaryId: number;
  beneficiaryName: string;
  totalAmount: number;
  status: string;
  paymentDate: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string;
  commissionCount: number;
  clientCount: number;
};

export default function AdminPaymentBatches() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: commissions, isLoading: isLoadingComm } = useListCommissions();

  // Local state (API hooks not yet generated — using direct fetch pattern)
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [selectedCommIds, setSelectedCommIds] = useState<Set<number>>(new Set());
  const [confirmBatchId, setConfirmBatchId] = useState<number | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  // Filter commissions eligible for batching
  const eligibleCommissions = (commissions ?? []).filter(
    (c) => c.status === "READY_FOR_PAYOUT" && !c.paymentBatchId,
  );

  const toggleCommission = (id: number) => {
    setSelectedCommIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTotal = eligibleCommissions
    .filter((c) => selectedCommIds.has(c.id))
    .reduce((s, c) => s + c.amount, 0);

  const handleCreateBatch = async () => {
    if (selectedCommIds.size === 0) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/payment-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commissionIds: [...selectedCommIds] }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Unknown error");
      }
      const batch = await res.json();
      setBatches((prev) => [batch, ...prev]);
      setSelectedCommIds(new Set());
      setShowCreateDialog(false);
      toast({ title: "Payment batch created", description: `Batch #${batch.id} — ${[...selectedCommIds].length} commissions` });
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
    } catch (err: any) {
      toast({ title: "Failed to create batch", description: err.message, variant: "destructive" });
    }
  };

  const handleConfirm = async () => {
    if (!confirmBatchId) return;
    setIsConfirming(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/payment-batches/${confirmBatchId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentReference: paymentRef }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Unknown error");
      }
      setBatches((prev) =>
        prev.map((b) => b.id === confirmBatchId ? { ...b, status: "CONFIRMED", paymentReference: paymentRef } : b)
      );
      setConfirmBatchId(null);
      setPaymentRef("");
      toast({ title: "Batch confirmed & commissions marked PAID" });
    } catch (err: any) {
      toast({ title: "Failed to confirm batch", description: err.message, variant: "destructive" });
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t.paymentBatches.title}</h2>
          <p className="text-muted-foreground mt-1">
            {t.paymentBatches.subtitle}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> {t.paymentBatches.newBatch}
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-3">
        {[
          { label: t.paymentBatches.readyForPayout, value: eligibleCommissions.length, color: "text-amber-600" },
          { label: t.paymentBatches.totalEligible, value: formatCurrency(eligibleCommissions.reduce((s, c) => s + c.amount, 0), locale), color: "text-emerald-600" },
          { label: t.paymentBatches.draftBatches, value: batches.filter((b) => b.status === "DRAFT").length, color: "text-blue-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 dir-ltr ${stat.color}`} dir="ltr">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t.paymentBatches.allBatches}</CardTitle>
          <CardDescription>{t.paymentBatches.allBatchesDesc}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? (
            <Empty
              icon={CreditCard}
              title={t.paymentBatches.noBatches}
              description={t.paymentBatches.noBatchesDesc}
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.paymentBatches.batch}</TableHead>
                  <TableHead>{t.paymentBatches.beneficiary}</TableHead>
                  <TableHead>{t.paymentBatches.commissions}</TableHead>
                  <TableHead className="text-right">{t.paymentBatches.total}</TableHead>
                  <TableHead>{t.paymentBatches.status}</TableHead>
                  <TableHead>{t.paymentBatches.created}</TableHead>
                  <TableHead className="text-right">{t.paymentBatches.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="font-medium" dir="ltr">{t.paymentBatches.batch} #{batch.id}</div>
                      {batch.paymentReference && (
                        <div className="text-xs text-muted-foreground font-mono" dir="ltr">{batch.paymentReference}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{batch.beneficiaryName}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.roles[batch.beneficiaryType as keyof typeof t.roles] ?? batch.beneficiaryType}
                      </div>
                    </TableCell>
                    <TableCell>{batch.commissionCount} {t.paymentBatches.commissionsSuffix} · {batch.clientCount} {t.paymentBatches.clientsSuffix}</TableCell>
                    <TableCell className="text-right font-bold whitespace-nowrap">
                      {formatCurrency(batch.totalAmount, locale)}
                    </TableCell>
                    <TableCell><StatusBadge status={batch.status} t={t} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(batch.createdAt, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedBatch(batch); setShowDetailDialog(true); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {batch.status === "DRAFT" && (
                          <Button size="sm" onClick={() => setConfirmBatchId(batch.id)} className="gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {t.paymentBatches.confirm}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Batch Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.paymentBatches.createTitle}</DialogTitle>
            <DialogDescription>
              {t.paymentBatches.createDesc}
            </DialogDescription>
          </DialogHeader>

          {isLoadingComm ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : eligibleCommissions.length === 0 ? (
            <Empty icon={CreditCard} title={t.paymentBatches.noEligibleCommissions} description={t.paymentBatches.noEligibleDesc} className="py-8" />
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>{t.paymentBatches.commissions}</TableHead>
                    <TableHead>{t.paymentBatches.beneficiary}</TableHead>
                    <TableHead>{t.paymentBatches.type}</TableHead>
                    <TableHead className="text-right">{t.paymentBatches.amount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleCommissions.map((c) => (
                    <TableRow
                      key={c.id}
                      className={`cursor-pointer ${selectedCommIds.has(c.id) ? "bg-primary/5" : ""}`}
                      onClick={() => toggleCommission(c.id)}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedCommIds.has(c.id)}
                          onChange={() => toggleCommission(c.id)}
                          className="h-4 w-4 rounded border-border accent-primary"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium" dir="ltr">#{c.id}</div>
                        <div className="text-xs text-muted-foreground">{c.clientName} · {c.orderName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{c.userName}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.roles[c.roleType as keyof typeof t.roles] ?? c.roleType}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{c.commissionType?.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 whitespace-nowrap">
                        {formatCurrency(c.amount, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selectedCommIds.size > 0 && (
                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div>
                    <p className="font-semibold">{t.paymentBatches.commissionsSelected.replace("{count}", String(selectedCommIds.size))}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.paymentBatches.total}: <span className="font-bold text-primary">{formatCurrency(selectedTotal, locale)}</span>
                    </p>
                  </div>
                  <Button onClick={handleCreateBatch}>
                    <Plus className="me-2 h-4 w-4" /> {t.paymentBatches.createBtn}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Batch Dialog */}
      <AlertDialog open={confirmBatchId !== null} onOpenChange={(open) => !open && setConfirmBatchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.paymentBatches.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.paymentBatches.confirmDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-4">
            <label className="text-sm font-medium mb-2 block">{t.paymentBatches.paymentReference}</label>
            <Input
              placeholder={t.paymentBatches.paymentReferencePlaceholder}
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="text-start"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isConfirming}>
              {isConfirming ? t.paymentBatches.confirming : t.paymentBatches.confirmBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
