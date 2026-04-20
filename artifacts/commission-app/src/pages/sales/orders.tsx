import { useState } from "react";
import { 
  useListOrders, 
  getListOrdersQueryKey,
} from "@workspace/api-client-react"
import { format, parseISO } from "date-fns";
import { ShoppingCart, Plus } from "lucide-react";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { OrderWizardDialog } from "@/components/OrderWizardDialog";

export default function SalesOrders() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const { data: orders, isLoading: isOrdersLoading } = useListOrders({
    query: { queryKey: getListOrdersQueryKey() }
  });

  if (isOrdersLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
          <p className="text-muted-foreground mt-1">
            Submit new orders and view your order history.
          </p>
        </div>
        <Button onClick={() => setIsWizardOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Client & Order
        </Button>
      </div>

      <OrderWizardDialog open={isWizardOpen} onOpenChange={setIsWizardOpen} />

      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!orders || orders.length === 0 ? (
            <Empty 
              icon={ShoppingCart}
              title="No orders"
              description="You haven't submitted any orders yet."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(order.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">{order.orderName}</TableCell>
                    <TableCell>
                      <Link
                        to={`/clients/${order.clientId}`}
                        className="text-primary hover:underline"
                      >
                        {order.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      ${order.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.status === "COMPLETED" ? "default" : "secondary"} className={order.status === "COMPLETED" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                        {order.status}
                      </Badge>
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