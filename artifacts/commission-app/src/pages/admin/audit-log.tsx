import { useState } from "react";
import { Shield, Filter, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";

const ACTION_COLORS: Record<string, string> = {
  ORDER_STATUS_ADMIN_OVERRIDE: "bg-red-50 text-red-700 border-red-200",
  ORDER_CREATED:               "bg-emerald-50 text-emerald-700 border-emerald-200",
  ORDER_STATUS_CHANGED:        "bg-blue-50 text-blue-700 border-blue-200",
  COMMISSION_GENERATED:        "bg-purple-50 text-purple-700 border-purple-200",
  COMMISSION_STATUS_CHANGED:   "bg-amber-50 text-amber-700 border-amber-200",
  PAYMENT_BATCH_CONFIRMED:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAYMENT_BATCH_CREATED:       "bg-blue-50 text-blue-700 border-blue-200",
  CLIENT_CREATED:              "bg-teal-50 text-teal-700 border-teal-200",
  CLIENT_UPDATED:              "bg-slate-100 text-slate-700 border-slate-200",
  SETTINGS_UPDATED:            "bg-orange-50 text-orange-700 border-orange-200",
};

export default function AdminAuditLog() {
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ entityType: "", actionType: "", search: "" });
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const params = new URLSearchParams();
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.actionType) params.set("actionType", filters.actionType);
      const res = await fetch(`/api/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : data.logs ?? []);
        setTotalCount(data.total ?? (Array.isArray(data) ? data.length : 0));
      }
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!filters.search) return true;
    const s = filters.search.toLowerCase();
    return (
      log.actionType?.toLowerCase().includes(s) ||
      log.userName?.toLowerCase().includes(s) ||
      log.reason?.toLowerCase().includes(s) ||
      String(log.entityId).includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.auditLog.title}</h2>
        <p className="text-muted-foreground mt-1">
          {t.auditLog.subtitle}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filters.entityType} onValueChange={(v) => setFilters((p) => ({ ...p, entityType: v }))}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t.auditLog.allEntities} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.auditLog.allEntities}</SelectItem>
            {["order", "commission", "client", "payment_batch", "commission_rule", "package", "settings", "user"].map((e) => (
              <SelectItem key={e} value={e}>{e.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder={t.auditLog.searchPlaceholder}
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          className="w-72"
        />

        <Button onClick={loadLogs} variant={hasLoaded ? "outline" : "default"} className="gap-2">
          <Filter className="h-4 w-4" />
          {hasLoaded ? t.auditLog.refresh : t.auditLog.loadLogs}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t.auditLog.auditTrail}
          </CardTitle>
          <CardDescription>
            {hasLoaded ? t.auditLog.showingEntries.replace("{count}", String(filteredLogs.length)) : t.auditLog.clickToLoad}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !hasLoaded ? (
            <Empty icon={Shield} title={t.auditLog.notLoadedTitle} description={t.auditLog.notLoadedDesc} className="py-12" />
          ) : filteredLogs.length === 0 ? (
            <Empty icon={Shield} title={t.auditLog.noEntriesTitle} description={t.auditLog.noEntriesDesc} className="py-12" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.auditLog.time}</TableHead>
                  <TableHead>{t.auditLog.user}</TableHead>
                  <TableHead>{t.auditLog.action}</TableHead>
                  <TableHead>{t.auditLog.entity}</TableHead>
                  <TableHead>{t.auditLog.detailsReason}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className={log.actionType === "ORDER_STATUS_ADMIN_OVERRIDE" ? "bg-red-50/30" : ""}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.userName}</div>
                      <div className="text-xs text-muted-foreground">{t.roles[log.userRole as keyof typeof t.roles] ?? log.userRole}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs whitespace-nowrap ${ACTION_COLORS[log.actionType] ?? "bg-slate-100 text-slate-600"}`}>
                        {log.actionType?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono capitalize" dir="ltr">{log.entityType} #{log.entityId}</span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {log.reason && (
                        <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-1">
                          {t.auditLog.reason} {log.reason}
                        </p>
                      )}
                      {log.previousValue && log.newValue && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                          <code className="bg-red-50 text-red-700 rounded px-1 py-0.5" dir="ltr">
                            {JSON.stringify(JSON.parse(log.previousValue)).slice(0, 40)}
                          </code>
                          <ChevronDown className="h-3 w-3 rotate-[-90deg] shrink-0" />
                          <code className="bg-emerald-50 text-emerald-700 rounded px-1 py-0.5" dir="ltr">
                            {JSON.stringify(JSON.parse(log.newValue)).slice(0, 40)}
                          </code>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
