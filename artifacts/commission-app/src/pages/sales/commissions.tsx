import { useListCommissions } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { DollarSign } from "lucide-react";

export default function SalesCommissions() {
  const { data: commissions, isLoading } = useListCommissions();

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
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totals = (commissions ?? []).reduce(
    (acc, c) => {
      acc.total += c.amount;
      if (c.status === "PAID") acc.paid += c.amount;
      else acc.unpaid += c.amount;
      return acc;
    },
    { total: 0, paid: 0, unpaid: 0 },
  );
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Commissions</h2>
        <p className="text-muted-foreground mt-1">
          Your earnings from direct sales.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-muted/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Earned</p>
              <h3 className="text-2xl font-bold text-green-600">${fmt(totals.total)}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">Paid</p>
            <h3 className="text-2xl font-bold text-green-700">${fmt(totals.paid)}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">Unpaid</p>
            <h3 className="text-2xl font-bold text-amber-700">${fmt(totals.unpaid)}</h3>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {!commissions || commissions.length === 0 ? (
            <Empty 
              icon={DollarSign}
              title="No commissions yet"
              description="Earnings will appear here when your orders are completed."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(commission.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {commission.orderName || "Unknown Order"}
                    </TableCell>
                    <TableCell>{commission.clientName || 'Unknown Client'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={commission.status === "PAID" ? "default" : "secondary"} className={commission.status === "PAID" ? "bg-green-100 text-green-800 hover:bg-green-100 w-fit" : "w-fit"}>
                          {commission.status}
                        </Badge>
                        {commission.status === "PAID" && (
                          <div
                            className="text-xs text-muted-foreground"
                            data-testid={`text-paid-info-${commission.id}`}
                          >
                            {commission.paidAt ? (
                              <>
                                Paid on{" "}
                                {format(parseISO(commission.paidAt), "MMM d, yyyy")}
                              </>
                            ) : (
                              "Paid (date unavailable)"
                            )}
                            {commission.paidByName ? ` by ${commission.paidByName}` : ""}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      ${commission.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
