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
            title: ids.length === 1 ? "Commission marked as paid" : "Commissions marked as paid",
            description: `${ids.length} commission${ids.length === 1 ? "" : "s"} updated.`,
          });
          setSelected(new Set());
          setConfirmOpen(false);
          queryClient.invalidateQueries({ queryKey: getListCommissionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: (err: ApiError<{ error?: string }>) => {
          toast({
            title: "Error",
            description: err?.data?.error || "Failed to update commissions",
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
        <h2 className="text-3xl font-bold tracking-tight">Commissions</h2>
        <p className="text-muted-foreground mt-1">
          View all commissions generated from completed orders.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-full text-amber-700">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Outstanding (Unpaid)</p>
              <h3 className="text-2xl font-bold text-amber-700">${fmt(totals.unpaid)}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full text-green-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Paid Out</p>
              <h3 className="text-2xl font-bold text-green-700">${fmt(totals.paid)}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Commission Ledger</CardTitle>
            <CardDescription>
              Record of all commission payouts across the company.
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
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            {selectedUnpaid.length > 0 && (
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={markPaid.isPending}
              >
                Mark {selectedUnpaid.length} as Paid
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-end gap-3 px-6 pb-4 border-b">
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-status" className="text-xs">
                Status
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
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-from" className="text-xs">
                From
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
                To
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
                Clear
              </Button>
            )}
            <div className="ml-auto text-sm text-muted-foreground">
              {filtered.length} of {commissions?.length ?? 0} commissions
            </div>
          </div>
          {!commissions || commissions.length === 0 ? (
            <Empty
              icon={DollarSign}
              title="No commissions yet"
              description="Commissions will appear here once orders are marked as completed."
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
                      aria-label="Select all unpaid"
                    />
                  </TableHead>
                  <TableHead>Earner</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Source Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No commissions match the current filters.
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
                        {commission.userName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {commission.roleType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {commission.orderName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Order #{commission.orderId}
                        </div>
                      </TableCell>
                      <TableCell>{commission.clientName}</TableCell>
                      <TableCell>
                        {format(parseISO(commission.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        +${fmt(commission.amount)}
                      </TableCell>
                      <TableCell>
                        {commission.status === "PAID" ? (
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200 w-fit"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Paid
                            </Badge>
                            {commission.paidAt && (
                              <div
                                className="text-xs text-muted-foreground"
                                data-testid={`text-paid-info-${commission.id}`}
                              >
                                Paid on{" "}
                                {format(parseISO(commission.paidAt), "MMM d, yyyy")}
                                {commission.paidByName
                                  ? ` by ${commission.paidByName}`
                                  : ""}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Unpaid
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
                            Mark Paid
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
            <AlertDialogTitle>Mark commissions as paid?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to mark {selectedUnpaid.length} commission
              {selectedUnpaid.length === 1 ? "" : "s"} as paid. Once marked
              paid, the source order can no longer be reverted to pending.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleMarkPaid(selectedUnpaid)}
              disabled={markPaid.isPending}
            >
              {markPaid.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
