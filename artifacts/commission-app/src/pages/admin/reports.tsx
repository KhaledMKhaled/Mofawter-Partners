import { useState } from "react";
import { FileBarChart2, Download, TrendingUp, ShoppingCart, DollarSign, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useListUsers } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/format";

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-600 border-slate-200",
  UNDER_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  APPROVED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  IN_EXECUTION: "bg-amber-50 text-amber-700 border-amber-200",
  EXECUTED: "bg-orange-50 text-orange-700 border-orange-200",
  COLLECTED: "bg-teal-50 text-teal-700 border-teal-200",
  COMMISSION_PENDING: "bg-purple-50 text-purple-700 border-purple-200",
  COMMISSION_READY: "bg-violet-50 text-violet-700 border-violet-200",
  COMMISSION_PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <Badge variant="outline" className={`text-xs whitespace-nowrap ${STATUS_COLORS[status] ?? ""}`}>
      {t.statuses[status as keyof typeof t.statuses] ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

// ─── Reusable Report Filters ──────────────────────────────────────────────────
function ReportFilters({
  filters, setFilters, onLoad, isLoading, extraFilters
}: {
  filters: Record<string, string>;
  setFilters: (f: Record<string, string>) => void;
  onLoad: () => void;
  isLoading: boolean;
  extraFilters?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-end gap-3 flex-wrap border p-4 rounded-lg bg-muted/30">
      <div>
        <Label className="text-xs mb-1.5 block">{t.adminReports.fromLabel}</Label>
        <Input type="date" className="w-40" value={filters.dateFrom ?? ""} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs mb-1.5 block">{t.adminReports.toLabel}</Label>
        <Input type="date" className="w-40" value={filters.dateTo ?? ""} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs mb-1.5 block">{t.adminReports.clientNameLabel}</Label>
        <Input className="w-44" placeholder={t.adminReports.searchClient} value={filters.clientName ?? ""} onChange={(e) => setFilters({ ...filters, clientName: e.target.value })} />
      </div>
      {extraFilters}
      <Button onClick={onLoad} disabled={isLoading} className="gap-2 self-end">
        <FileBarChart2 className="h-4 w-4" />
        {isLoading ? t.adminReports.loading : t.adminReports.runReport}
      </Button>
    </div>
  );
}

// ─── Order Reports Tab ────────────────────────────────────────────────────────
function OrdersReport({ type }: { type: "pending" | "completed" }) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      const res = await fetch(`/api/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const terminalStatuses = ["COMMISSION_PAID", "CANCELLED", "REJECTED"];
        if (type === "pending") {
          setRows(data.filter((o: any) => !terminalStatuses.includes(o.status)));
        } else {
          setRows(data.filter((o: any) => ["COLLECTED", "COMMISSION_PENDING", "COMMISSION_READY", "COMMISSION_PAID"].includes(o.status)));
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ReportFilters filters={filters} setFilters={setFilters} onLoad={load} isLoading={isLoading} />
      {rows.length === 0 ? (
        <Empty icon={ShoppingCart} title={t.adminReports.noOrdersTitle.replace("{type}", type === "pending" ? t.adminReports.tabPendingOrders : t.adminReports.tabCompletedOrders)} description={t.adminReports.noOrdersDesc} className="py-10" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.adminReports.orderIdTable}</TableHead>
                  <TableHead>{t.adminReports.clientTable}</TableHead>
                  <TableHead>{t.adminReports.packageTable}</TableHead>
                  <TableHead>{t.adminReports.salesRepTable}</TableHead>
                  <TableHead>{t.adminReports.typeTable}</TableHead>
                  <TableHead className="text-right">{t.adminReports.amountTable}</TableHead>
                  <TableHead>{t.adminReports.statusTable}</TableHead>
                  <TableHead>{t.adminReports.dateTable}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{o.clientName}</div>
                      {o.taxCardNumber && <div className="text-xs text-muted-foreground" dir="ltr">{o.taxCardNumber}</div>}
                    </TableCell>
                    <TableCell>{o.packageName ?? o.orderName}</TableCell>
                    <TableCell>{o.salesName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{t.paymentBatches.orderTypes[o.orderType as keyof typeof t.paymentBatches.orderTypes] ?? o.orderType?.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap" dir="ltr">
                      {formatCurrency(o.amount, locale)}
                    </TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {o.orderDate ? formatDate(o.orderDate, locale) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t.adminReports.totalOrdersCount.replace("{count}", String(rows.length))}</p>
              <p className="font-semibold text-sm">
                {t.adminReports.totalOrdersAmount.replace("{amount}", formatCurrency(rows.reduce((s, o) => s + Number(o.amount), 0), locale))}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Commissions Report Tab ───────────────────────────────────────────────────
function CommissionsReport({ type }: { type: "pending" | "paid" }) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/commissions", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (type === "pending") {
          setRows(data.filter((c: any) => !["PAID", "CANCELLED"].includes(c.status)));
        } else {
          setRows(data.filter((c: any) => c.status === "PAID"));
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ReportFilters filters={filters} setFilters={setFilters} onLoad={load} isLoading={isLoading} />
      {rows.length === 0 ? (
        <Empty icon={DollarSign} title={t.adminReports.noCommissionsTitle.replace("{type}", type === "pending" ? t.adminReports.tabPendingCommissions : t.adminReports.tabPaidCommissions)} description={t.adminReports.noCommissionsDesc} className="py-10" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.adminReports.commissionTable}</TableHead>
                  <TableHead>{t.adminReports.beneficiaryTable}</TableHead>
                  <TableHead>{t.adminReports.clientTable}</TableHead>
                  <TableHead>{t.adminReports.typeTable}</TableHead>
                  <TableHead className="text-right">{t.adminReports.baseAmountTable}</TableHead>
                  <TableHead className="text-right">{t.adminReports.commissionTable}</TableHead>
                  <TableHead>{t.adminReports.statusTable}</TableHead>
                  {type === "paid" && <TableHead>{t.adminReports.paidAtTable}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs" dir="ltr">#{c.id}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.userName}</div>
                      <Badge variant="outline" className={`text-[10px] ${c.roleType === "SALES" ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}`}>
                        {t.roles[c.roleType as keyof typeof t.roles] ?? c.roleType}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.clientName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{t.commissionRules.eventTypes[c.commissionType as keyof typeof t.commissionRules.eventTypes] ?? c.commissionType?.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap" dir="ltr">
                      {formatCurrency(c.baseAmount, locale)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary whitespace-nowrap" dir="ltr">
                      {formatCurrency(c.amount, locale)}
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    {type === "paid" && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {c.paidAt ? formatDate(c.paidAt, locale) : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t.adminReports.totalCommissionsCount.replace("{count}", String(rows.length))}</p>
              <p className="font-semibold text-sm">
                {t.adminReports.totalCommissionsAmount.replace("{amount}", formatCurrency(rows.reduce((s, c) => s + Number(c.amount), 0), locale))}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sales Performance Tab ────────────────────────────────────────────────────
function SalesPerformanceReport() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { data: users } = useListUsers({ role: "SALES" });

  const load = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const [ordersRes, commissionsRes] = await Promise.all([
        fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/commissions", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const orders = await ordersRes.json();
      const commissions = await commissionsRes.json();

      const perf = (users ?? []).map((u) => {
        const userOrders = orders.filter((o: any) => o.salesId === u.id);
        const userComms = commissions.filter((c: any) => c.userId === u.id && c.roleType === "SALES");
        return {
          userId: u.id,
          name: u.name,
          totalOrders: userOrders.length,
          completedOrders: userOrders.filter((o: any) => ["COLLECTED", "COMMISSION_PAID"].includes(o.status)).length,
          totalRevenue: userOrders.reduce((s: number, o: any) => s + Number(o.amount), 0),
          totalCommissions: userComms.reduce((s: number, c: any) => s + Number(c.amount), 0),
          paidCommissions: userComms.filter((c: any) => c.status === "PAID").reduce((s: number, c: any) => s + Number(c.amount), 0),
        };
      });
      setRows(perf.sort((a, b) => b.totalRevenue - a.totalRevenue));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={load} disabled={isLoading} className="gap-2">
          <TrendingUp className="h-4 w-4" /> {isLoading ? t.adminReports.loading : t.adminReports.generateReportBtn}
        </Button>
      </div>
      {rows.length === 0 ? (
        <Empty icon={Users} title={t.adminReports.noPerformanceTitle} description={t.adminReports.noPerformanceDesc} className="py-10" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.adminReports.salesRepCol}</TableHead>
                  <TableHead className="text-right">{t.adminReports.totalOrdersCol}</TableHead>
                  <TableHead className="text-right">{t.adminReports.closedCol}</TableHead>
                  <TableHead className="text-right">{t.adminReports.revenueCol}</TableHead>
                  <TableHead className="text-right">{t.adminReports.earnedCol}</TableHead>
                  <TableHead className="text-right">{t.adminReports.paidOutCol}</TableHead>
                  <TableHead className="text-right">{t.adminReports.pendingCol}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-right" dir="ltr">{r.totalOrders}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium" dir="ltr">{r.completedOrders}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap" dir="ltr">
                      {formatCurrency(r.totalRevenue, locale)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary whitespace-nowrap" dir="ltr">
                      {formatCurrency(r.totalCommissions, locale)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 whitespace-nowrap" dir="ltr">
                      {formatCurrency(r.paidCommissions, locale)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600 whitespace-nowrap" dir="ltr">
                      {formatCurrency(r.totalCommissions - r.paidCommissions, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────
export default function AdminReports() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.adminReports.title}</h2>
        <p className="text-muted-foreground mt-1">
          {t.adminReports.subtitle}
        </p>
      </div>

      <Tabs defaultValue="pending-orders">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="pending-orders" className="gap-2"><ShoppingCart className="h-3.5 w-3.5" />{t.adminReports.tabPendingOrders}</TabsTrigger>
          <TabsTrigger value="completed-orders" className="gap-2"><ShoppingCart className="h-3.5 w-3.5" />{t.adminReports.tabCompletedOrders}</TabsTrigger>
          <TabsTrigger value="pending-commissions" className="gap-2"><DollarSign className="h-3.5 w-3.5" />{t.adminReports.tabPendingCommissions}</TabsTrigger>
          <TabsTrigger value="paid-commissions" className="gap-2"><DollarSign className="h-3.5 w-3.5" />{t.adminReports.tabPaidCommissions}</TabsTrigger>
          <TabsTrigger value="performance" className="gap-2"><TrendingUp className="h-3.5 w-3.5" />{t.adminReports.tabPerformance}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending-orders"><OrdersReport type="pending" /></TabsContent>
        <TabsContent value="completed-orders"><OrdersReport type="completed" /></TabsContent>
        <TabsContent value="pending-commissions"><CommissionsReport type="pending" /></TabsContent>
        <TabsContent value="paid-commissions"><CommissionsReport type="paid" /></TabsContent>
        <TabsContent value="performance"><SalesPerformanceReport /></TabsContent>
      </Tabs>
    </div>
  );
}
