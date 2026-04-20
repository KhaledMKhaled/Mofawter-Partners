import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, DollarSign, PackageCheck, Users } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";

export default function AdminDashboard() {
  const { t, locale } = useI18n();
  const { data: summary, isLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.dashboard.adminTitle}</h2>
        <p className="text-muted-foreground mt-1">{t.dashboard.adminSubtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.totalOrders}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.completedOrders} {t.dashboard.completed}، {summary.pendingOrders} {t.dashboard.pending}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.totalSalesRevenue}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 truncate" dir="ltr">
              {formatCurrency(summary.totalSales, locale)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.allCompletedOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.totalCommissions}</CardTitle>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate" dir="ltr">
              {formatCurrency(summary.totalCommissions, locale)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.paidToSalesAndDist}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.dashboard.companyTeam}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.teamSize || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.activeUsers}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t.dashboard.recentOrders}</CardTitle>
              <CardDescription>{t.dashboard.latestOrdersSubmitted}</CardDescription>
            </div>
            <Link href="/admin/orders">
              <Button variant="outline" size="sm">{t.common.viewAll}</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {summary.recentOrders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">{t.dashboard.noOrders}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.dashboard.order}</TableHead>
                    <TableHead>{t.dashboard.client}</TableHead>
                    <TableHead className="text-right">{t.common.amount}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentOrders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderName}</TableCell>
                      <TableCell>{order.clientName}</TableCell>
                      <TableCell className="text-right whitespace-nowrap" dir="ltr">
                        {formatCurrency(order.amount, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.status === "COMPLETED" || order.status === "COLLECTED" ? "default" : "secondary"} className={order.status === "COMPLETED" || order.status === "COLLECTED" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}>
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

        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t.dashboard.recentCommissions}</CardTitle>
              <CardDescription>{t.dashboard.latestCommissions}</CardDescription>
            </div>
            <Link href="/admin/commissions">
              <Button variant="outline" size="sm">{t.common.viewAll}</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {summary.recentCommissions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">{t.dashboard.noCommissions}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.dashboard.user}</TableHead>
                    <TableHead>{t.dashboard.order}</TableHead>
                    <TableHead className="text-right">{t.common.amount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentCommissions.map(comm => (
                    <TableRow key={comm.id}>
                      <TableCell>
                        <div className="font-medium">{comm.userName}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.roles[comm.roleType as keyof typeof t.roles] ?? comm.roleType}
                        </div>
                      </TableCell>
                      <TableCell>{comm.orderName}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600 whitespace-nowrap" dir="ltr">
                        +{formatCurrency(comm.amount, locale)}
                      </TableCell>
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
