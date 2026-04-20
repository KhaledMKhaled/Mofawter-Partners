import { 
  useListCommissions, 
  getListCommissionsQueryKey 
} from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { DollarSign, CheckCircle2, Clock } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export default function AdminCommissions() {
  const { data: commissions, isLoading } = useListCommissions({
    query: { queryKey: getListCommissionsQueryKey() }
  });

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
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Commissions</h2>
        <p className="text-muted-foreground mt-1">
          View all commissions generated from completed orders.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission Ledger</CardTitle>
          <CardDescription>
            Record of all commission payouts across the company.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
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
                  <TableHead>Earner</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Source Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="font-medium">{commission.userName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {commission.roleType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{commission.orderName}</div>
                      <div className="text-xs text-muted-foreground">Order #{commission.orderId}</div>
                    </TableCell>
                    <TableCell>{commission.clientName}</TableCell>
                    <TableCell>{format(parseISO(commission.createdAt), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      +${commission.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {commission.status === "PAID" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Paid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Clock className="mr-1 h-3 w-3" />
                          Unpaid
                        </Badge>
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
