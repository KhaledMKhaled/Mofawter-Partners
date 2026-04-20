import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, DollarSign, PackageCheck, Users, UserSquare2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";

export default function DistributorDashboard() {
  const { t, locale } = useI18n();
  const { data: summary, isLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
      </div>
    );
  }
  if (!summary) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.dashboard.distributorTitle}</h2>
        <p className="text-muted-foreground mt-1">{t.dashboard.distributorSubtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.totalOrders}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">{summary.completedOrders} {t.dashboard.completed}، {summary.pendingOrders} {t.dashboard.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.totalSalesRevenue}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalSales, locale)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.fromTeamOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.myCommissions}</CardTitle>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalCommissions, locale)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.earnedFromTeamSales}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.salesAgents}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.teamSize || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.activeTeamMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.clientsCount}</CardTitle>
            <UserSquare2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.clientCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.assignedToTeam}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>{t.dashboard.teamOrders}</CardTitle><CardDescription>{t.dashboard.latestTeamOrders}</CardDescription></div>
          </CardHeader>
          <CardContent>
            {summary.recentOrders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">{t.dashboard.noOrders}</div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t.dashboard.order}</TableHead><TableHead>{t.dashboard.client}</TableHead>
                  <TableHead className="text-right">{t.common.amount}</TableHead><TableHead>{t.common.status}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {summary.recentOrders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderName}</TableCell>
                      <TableCell>{order.clientName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.amount, locale)}</TableCell>
                      <TableCell>
                        <Badge variant={["COMPLETED","COLLECTED"].includes(order.status) ? "default" : "secondary"} className={["COMPLETED","COLLECTED"].includes(order.status) ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                          {t.orderStatus[order.status as keyof typeof t.orderStatus] ?? order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>{t.dashboard.recentCommissions}</CardTitle><CardDescription>{t.dashboard.latestCommissionsEarned}</CardDescription></div>
            <Link href="/distributor/commissions"><Button variant="outline" size="sm">{t.common.viewAll}</Button></Link>
          </CardHeader>
          <CardContent>
            {summary.recentCommissions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">{t.dashboard.noCommissions}</div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t.dashboard.order}</TableHead><TableHead className="text-right">{t.common.amount}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {summary.recentCommissions.map(comm => (
                    <TableRow key={comm.id}>
                      <TableCell className="font-medium">{comm.orderName}</TableCell>
                      <TableCell className="text-right text-green-600">+{formatCurrency(comm.amount, locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}