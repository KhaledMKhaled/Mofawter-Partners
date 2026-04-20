import {
  useListOrders,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Clock, ShoppingCart } from "lucide-react";
import { Link } from "wouter";

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

export default function DistributorOrders() {
  const { data: orders, isLoading } = useListOrders({
    query: { queryKey: getListOrdersQueryKey() },
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
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Team Orders</h2>
        <p className="text-muted-foreground mt-1">
          All orders submitted by sales agents on your team.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
          <CardDescription>
            Orders are completed by an admin, which generates the commissions you and your team earn.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!orders || orders.length === 0 ? (
            <Empty
              icon={ShoppingCart}
              title="No orders yet"
              description="Orders submitted by your sales agents will appear here."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Sales Agent</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(order.orderDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.orderName}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        #{order.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/clients/${order.clientId}`}
                        className="text-primary hover:underline"
                      >
                        {order.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.salesName}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${order.amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {(order.status as string) === "COLLECTED" ? (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-200"
                        >
                          <Clock className="mr-1 h-3 w-3" />
                          Pending
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
