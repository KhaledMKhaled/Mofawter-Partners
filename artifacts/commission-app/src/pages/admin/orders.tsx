import { useState } from "react";
import {
  useListOrders, useUpdateOrderStatus,
  getListOrdersQueryKey, getGetDashboardSummaryQueryKey, getListCommissionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, ChevronRight, AlertTriangle, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/format";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderWizardDialog } from "@/components/OrderWizardDialog";

// ─── Status Configuration ─────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  NEW:                "bg-slate-100 text-slate-700 border-slate-300",
  UNDER_REVIEW:       "bg-blue-50 text-blue-700 border-blue-200",
  APPROVED:           "bg-indigo-50 text-indigo-700 border-indigo-200",
  REJECTED:           "bg-red-50 text-red-700 border-red-200",
  IN_EXECUTION:       "bg-amber-50 text-amber-700 border-amber-200",
  EXECUTED:           "bg-orange-50 text-orange-700 border-orange-200",
  COLLECTED:          "bg-teal-50 text-teal-700 border-teal-200",
  COMMISSION_PENDING: "bg-purple-50 text-purple-700 border-purple-200",
  COMMISSION_READY:   "bg-violet-50 text-violet-700 border-violet-200",
  COMMISSION_PAID:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED:          "bg-rose-50 text-rose-600 border-rose-200",
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["IN_EXECUTION", "CANCELLED"],
  REJECTED: [],
  IN_EXECUTION: ["EXECUTED", "CANCELLED"],
  EXECUTED: ["COLLECTED", "CANCELLED"],
  COLLECTED: ["COMMISSION_PENDING"],
  COMMISSION_PENDING: ["COMMISSION_READY"],
  COMMISSION_READY: ["COMMISSION_PAID"],
  COMMISSION_PAID: [],
  CANCELLED: [],
};

const ALL_STATUSES = Object.keys(STATUS_COLORS);
const TERMINAL = ["COMMISSION_PAID", "REJECTED", "CANCELLED"];

type OrderRow = any;

export default function AdminOrders() {
  const { t, locale } = useI18n();
  const { data: orders, isLoading } = useListOrders({ query: { queryKey: getListOrdersQueryKey() } });
  const { data: me } = useGetMe();
  const updateStatus = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const isAdmin = me?.role === "ADMIN";
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  const [transitionDialog, setTransitionDialog] = useState<{
    order: OrderRow; targetStatus: string; isOverride: boolean;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [customTargetStatus, setCustomTargetStatus] = useState("");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCommissionsQueryKey() });
  };

  const handleTransition = (order: OrderRow, targetStatus: string) => {
    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    setTransitionDialog({ order, targetStatus, isOverride: !allowed.includes(targetStatus) });
    setOverrideReason("");
  };

  const confirmTransition = () => {
    if (!transitionDialog) return;
    const { order, targetStatus, isOverride } = transitionDialog;
    if (isOverride && !overrideReason.trim()) {
      toast({ title: t.orders.reasonRequired, description: t.orders.pleaseProvideReason, variant: "destructive" });
      return;
    }
    updateStatus.mutate(
      { id: order.id, data: { status: targetStatus as any, ...(isOverride ? { reason: overrideReason } : {}) } as any },
      {
        onSuccess: () => {
          const label = t.orderStatus[targetStatus as keyof typeof t.orderStatus] ?? targetStatus;
          toast({ title: t.orders.statusUpdated, description: `#${order.id} → ${label}` });
          invalidateAll();
          setTransitionDialog(null);
        },
        onError: (err: any) => {
          toast({ title: t.orders.failedUpdate, description: err?.data?.error ?? t.orders.couldNotUpdate, variant: "destructive" });
        },
      },
    );
  };

  const filteredOrders = (orders ?? []).filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!o.clientName?.toLowerCase().includes(s) && !o.orderName?.toLowerCase().includes(s) && !String(o.id).includes(s) && !o.taxCardNumber?.includes(s)) return false;
    }
    return true;
  });

  const stats = orders ? {
    total: orders.length,
    pending: orders.filter((o) => !TERMINAL.includes(o.status)).length,
    collected: orders.filter((o) => o.status === "COLLECTED" || o.status === "COMMISSION_PAID").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED" || o.status === "REJECTED").length,
  } : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-64" /></div>
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t.orders.title}</h2>
          <p className="text-muted-foreground mt-1">{t.orders.subtitle}</p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> {t.orders.newOrder}
        </Button>
      </div>

      {stats && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[
            { label: t.orders.totalOrders, value: stats.total, color: "text-foreground" },
            { label: t.orders.inProgress, value: stats.pending, color: "text-blue-600" },
            { label: t.orders.collected, value: stats.collected, color: "text-emerald-600" },
            { label: t.orders.rejectedCancelled, value: stats.cancelled, color: "text-red-500" },
          ].map((s) => (
            <Card key={s.label}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder={t.orders.searchPlaceholder} className="w-72" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder={t.orders.filterByStatus} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.orders.allStatuses}</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t.orderStatus[s as keyof typeof t.orderStatus]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }}>{t.common.clear}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <Empty icon={ShoppingCart} title={t.orders.noOrders} description={t.orders.noOrdersDesc} className="py-12" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.orders.orderDetails}</TableHead>
                  <TableHead>{t.orders.client}</TableHead>
                  <TableHead>{t.orders.team}</TableHead>
                  <TableHead>{t.orders.type}</TableHead>
                  <TableHead className="text-right">{t.orders.amount}</TableHead>
                  <TableHead>{t.orders.status}</TableHead>
                  <TableHead>{t.orders.date}</TableHead>
                  <TableHead className="text-right">{t.orders.action}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => {
                  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
                  const isTerminal = TERMINAL.includes(order.status);
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{order.orderName}</div>
                        <div className="text-xs text-muted-foreground font-mono" dir="ltr">#{order.id}</div>
                      </TableCell>
                      <TableCell>
                        <Link to={`/clients/${order.clientId}`} className="font-medium text-primary hover:underline">{order.clientName}</Link>
                        {order.taxCardNumber && <div className="text-xs text-muted-foreground font-mono" dir="ltr">{order.taxCardNumber}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{order.salesName}</div>
                        <div className="text-xs text-muted-foreground">{order.distributorName}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {t.orderType[order.orderType as keyof typeof t.orderType] ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium" dir="ltr">{formatCurrency(order.amount, locale)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs whitespace-nowrap ${STATUS_COLORS[order.status] ?? ""}`}>
                          {t.orderStatus[order.status as keyof typeof t.orderStatus] ?? order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(order.orderDate, locale)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {allowed.map((ns) => (
                            <Button key={ns} size="sm" variant="outline" className={`gap-1 text-xs ${locale === "ar" ? "flex-row-reverse" : ""}`} onClick={() => handleTransition(order, ns)}>
                              {t.orderStatus[ns as keyof typeof t.orderStatus] ?? ns}
                              <ChevronRight className={`h-3 w-3 ${locale === "ar" ? "rotate-180" : ""}`} />
                            </Button>
                          ))}
                          {isAdmin && !isTerminal && (
                            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground gap-1" onClick={() => {
                              setTransitionDialog({ order, targetStatus: "", isOverride: true });
                              setCustomTargetStatus("");
                              setOverrideReason("");
                            }}>
                              <AlertTriangle className="h-3 w-3" /> {t.orders.overrideBtn}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Status Transition Dialog */}
      <Dialog open={!!transitionDialog} onOpenChange={(open) => !open && setTransitionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {transitionDialog?.isOverride && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              {transitionDialog?.isOverride ? t.orders.adminOverride : t.orders.confirmStatusChange}
            </DialogTitle>
            <DialogDescription>
              {transitionDialog && (
                <>
                  {t.dashboard.order} <strong dir="ltr">#{transitionDialog.order.id}</strong> — {transitionDialog.order.clientName}
                  <br />
                  {transitionDialog.isOverride
                    ? t.orders.nonStandardTransition
                    : `${t.orderStatus[transitionDialog.order.status as keyof typeof t.orderStatus]} → ${t.orderStatus[transitionDialog.targetStatus as keyof typeof t.orderStatus] ?? transitionDialog.targetStatus}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {transitionDialog?.isOverride && !transitionDialog.targetStatus && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t.orders.targetStatus}</label>
                <Select value={customTargetStatus} onValueChange={(v) => {
                  setCustomTargetStatus(v);
                  setTransitionDialog((prev) => prev ? { ...prev, targetStatus: v } : prev);
                }}>
                  <SelectTrigger><SelectValue placeholder={t.orders.selectTargetStatus} /></SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.filter((s) => s !== transitionDialog?.order.status).map((s) => (
                      <SelectItem key={s} value={s}>{t.orderStatus[s as keyof typeof t.orderStatus]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {transitionDialog?.isOverride && (
            <div>
              <label className="text-sm font-medium mb-1.5 block text-amber-700">
                {t.orders.overrideReason} <span className="text-destructive">*</span>
              </label>
              <Textarea placeholder={t.orders.overrideReasonPlaceholder} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={3} className="text-sm" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionDialog(null)}>{t.common.cancel}</Button>
            <Button onClick={confirmTransition} disabled={updateStatus.isPending || (transitionDialog?.isOverride && !transitionDialog.targetStatus)} variant={transitionDialog?.isOverride ? "destructive" : "default"}>
              {updateStatus.isPending ? t.common.updating : transitionDialog?.isOverride ? t.orders.overrideStatus : t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
