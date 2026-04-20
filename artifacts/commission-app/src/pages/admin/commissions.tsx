import { useMemo, useState } from "react";
import {
  useListCommissions,
  useMarkCommissionsPaid,
  getListCommissionsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { DollarSign, CheckCircle2, Clock, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AdminCommissions() {
  const { t, locale } = useI18n();
  const { data: commissions, isLoading } = useListCommissions({
    query: { queryKey: getListCommissionsQueryKey() },
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const markPaid = useMarkCommissionsPaid();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const filtered = useMemo(() => {
    const list = commissions ?? [];
    const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const toTs = toDate ? new Date(toDate + "T23:59:59.999").getTime() : null;
    return list.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      const ts = new Date(c.createdAt).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }, [commissions, statusFilter, fromDate, toDate]);

  const unpaidIds = useMemo(
    () => filtered.filter((c) => c.status === "UNPAID").map((c) => c.id),
    [filtered],
  );

  const selectedUnpaid = useMemo(
    () => unpaidIds.filter((id) => selected.has(id)),
    [unpaidIds, selected],
  );

  const totals = useMemo(() => {
    const t = { paid: 0, unpaid: 0 };
    for (const c of filtered) {
      if (c.status === "PAID") t.paid += c.amount;
      else t.unpaid += c.amount;
    }
    return t;
  }, [filtered]);

  const csvEscape = (val: string | number | null | undefined) => {
    const s = val === null || val === undefined ? "" : String(val);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleExportCsv = () => {
    const headers = [
      "Earner",
      "Role",
      "Source Order",
      "Order ID",
      "Client",
      "Date",
      "Amount",
      "Status",
      "Paid At",
      "Paid By",
    ];
    const rows = filtered.map((c) => [
      c.userName ?? "",
      c.roleType,
      c.orderName ?? "",
      c.orderId,
      c.clientName ?? "",
      format(parseISO(c.createdAt), "yyyy-MM-dd"),
      c.amount.toFixed(2),
      c.status,
      c.paidAt ? format(parseISO(c.paidAt), "yyyy-MM-dd HH:mm:ss") : "",
      c.paidByName ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = format(new Date(), "yyyyMMdd-HHmmss");
    link.href = url;
    link.download = `commissions-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(unpaidIds) : new Set());
  };

  const handleMarkPaid = (ids: number[]) => {
    if (ids.length === 0) return;
    markPaid.mutate(
      { data: { ids } },
      {
        onSuccess: () => {
          toast({
            title: ids.length === 1 ? t.adminCommissions.markPaidSuccessSingle : t.adminCommissions.markPaidSuccessMulti,
            description: t.adminCommissions.markPaidSuccessDesc.replace("{count}", String(ids.length)),
          });
          setSelected(new Set());
          setConfirmOpen(false);
          queryClient.invalidateQueries({ queryKey: getListCommissionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: (err: ApiError<{ error?: string }>) => {
          toast({
            title: t.adminCommissions.errorUpdateTitle,
            description: err?.data?.error || t.adminCommissions.errorUpdateDesc,
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allUnpaidSelected =
    unpaidIds.length > 0 && unpaidIds.every((id) => selected.has(id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.adminCommissions.title}</h2>
        <p className="text-muted-foreground mt-1">
          {t.adminCommissions.subtitle}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-full text-amber-700">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t.adminCommissions.outstanding}</p>
              <h3 className="text-2xl font-bold text-amber-700 dir-ltr" dir="ltr">{formatCurrency(totals.unpaid, locale)}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full text-green-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t.adminCommissions.paidOut}</p>
              <h3 className="text-2xl font-bold text-green-700 dir-ltr" dir="ltr">{formatCurrency(totals.paid, locale)}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t.adminCommissions.ledgerTitle}</CardTitle>
            <CardDescription>
              {t.adminCommissions.ledgerDesc}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="me-2 h-4 w-4" />
              {t.adminCommissions.exportCsv}
            </Button>
            {selectedUnpaid.length > 0 && (
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={markPaid.isPending}
              >
                {t.adminCommissions.markAsPaidBtn.replace("{count}", String(selectedUnpaid.length))}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-end gap-3 px-6 pb-4 border-b">
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-status" className="text-xs">
                {t.adminCommissions.statusFilterLabel}
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as "ALL" | "UNPAID" | "PAID")}
              >
                <SelectTrigger
                  id="filter-status"
                  className="h-9 w-[140px]"
                  data-testid="select-filter-status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.adminCommissions.allStatuses}</SelectItem>
                  <SelectItem value="UNPAID">{t.adminCommissions.unpaid}</SelectItem>
                  <SelectItem value="PAID">{t.adminCommissions.paid}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-from" className="text-xs">
                {t.adminCommissions.from}
              </Label>
              <Input
                id="filter-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 w-[160px]"
                data-testid="input-filter-from"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-to" className="text-xs">
                {t.adminCommissions.to}
              </Label>
              <Input
                id="filter-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 w-[160px]"
                data-testid="input-filter-to"
              />
            </div>
            {(statusFilter !== "ALL" || fromDate || toDate) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setStatusFilter("ALL");
                  setFromDate("");
                  setToDate("");
                }}
                data-testid="button-clear-filters"
              >
                {t.adminCommissions.clearFilters}
              </Button>
            )}
            <div className="ms-auto text-sm text-muted-foreground">
              {t.adminCommissions.showingCount.replace("{filtered}", String(filtered.length)).replace("{total}", String(commissions?.length ?? 0))}
            </div>
          </div>
          {!commissions || commissions.length === 0 ? (
            <Empty
              icon={DollarSign}
              title={t.adminCommissions.noCommissions}
              description={t.adminCommissions.noCommissionsDesc}
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allUnpaidSelected}
                      disabled={unpaidIds.length === 0}
                      onCheckedChange={(v) => toggleAll(Boolean(v))}
                      aria-label={t.adminCommissions.selectAllUnpaid}
                    />
                  </TableHead>
                  <TableHead>{t.adminCommissions.earnerTable}</TableHead>
                  <TableHead>{t.adminCommissions.roleTable}</TableHead>
                  <TableHead>{t.adminCommissions.sourceOrderTable}</TableHead>
                  <TableHead>{t.adminCommissions.clientTable}</TableHead>
                  <TableHead>{t.adminCommissions.dateTable}</TableHead>
                  <TableHead className="text-right">{t.adminCommissions.amountTable}</TableHead>
                  <TableHead>{t.adminCommissions.statusTable}</TableHead>
                  <TableHead className="text-right">{t.adminCommissions.actionTable}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {t.adminCommissions.noMatch}
                    </TableCell>
                  </TableRow>
                ) : null}
                {filtered.map((commission) => {
                  const isUnpaid = commission.status === "UNPAID";
                  return (
                    <TableRow key={commission.id}>
                      <TableCell>
                        {isUnpaid ? (
                          <Checkbox
                            checked={selected.has(commission.id)}
                            onCheckedChange={(v) =>
                              toggleOne(commission.id, Boolean(v))
                            }
                            aria-label={`Select commission ${commission.id}`}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">
                        {commission.userName || t.adminCommissions.unknownUser}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {t.roles[commission.roleType as keyof typeof t.roles] ?? commission.roleType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {commission.orderName || t.adminCommissions.unknownOrder}
                        </div>
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          Order #{commission.orderId}
                        </div>
                      </TableCell>
                      <TableCell>{commission.clientName || t.adminCommissions.unknownClient}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(commission.createdAt, locale)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 whitespace-nowrap" dir="ltr">
                        +{formatCurrency(commission.amount, locale)}
                      </TableCell>
                      <TableCell>
                        {commission.status === "PAID" ? (
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 w-fit"
                            >
                              <CheckCircle2 className="me-1 h-3 w-3" />
                              {t.adminCommissions.paid}
                            </Badge>
                            <div
                              className="text-xs text-muted-foreground"
                              data-testid={`text-paid-info-${commission.id}`}
                            >
                              {commission.paidAt ? t.adminCommissions.paidOn.replace("{date}", formatDate(commission.paidAt, locale)) : t.adminCommissions.paidDateUnavailable}
                              {commission.paidByName
                                ? t.adminCommissions.paidBy.replace("{name}", commission.paidByName)
                                : ""}
                            </div>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                          >
                            <Clock className="me-1 h-3 w-3" />
                            {t.adminCommissions.unpaid}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isUnpaid && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid([commission.id])}
                            disabled={markPaid.isPending}
                          >
                            {t.adminCommissions.markPaidAction}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => !open && setConfirmOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.adminCommissions.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.adminCommissions.confirmDesc.replace("{count}", String(selectedUnpaid.length))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleMarkPaid(selectedUnpaid)}
              disabled={markPaid.isPending}
            >
              {markPaid.isPending ? t.adminCommissions.updating : t.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
