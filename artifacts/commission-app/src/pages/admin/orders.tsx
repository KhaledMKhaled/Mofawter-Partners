import { useState } from "react";
import { 
  useListOrders, 
  useUpdateOrderStatus,
  getListOrdersQueryKey,
  getGetDashboardSummaryQueryKey,
  getListCommissionsQueryKey
} from "@workspace/api-client-react"
import { ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays, parseISO } from "date-fns";
import { CheckCircle2, Clock, Info, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export default function AdminOrders() {
  const { data: orders, isLoading } = useListOrders({
    query: { queryKey: getListOrdersQueryKey() }
  });
  
  const updateStatus = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [confirmCompleteId, setConfirmCompleteId] = useState<number | null>(null);

  const handleComplete = (id: number) => {
    updateStatus.mutate(
      { id, data: { status: "COMPLETED" } },
      {
        onSuccess: () => {
          toast({
            title: "Order Completed",
            description: "The order has been marked as completed and commissions have been generated.",
          });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListCommissionsQueryKey() });
          setConfirmCompleteId(null);
        },
        onError: (err: ApiError<{ error?: string }>) => {
          toast({
            title: "Error",
            description: err?.data?.error || "Failed to update order status",
            variant: "destructive"
          });
        }
      }
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
        <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
        <p className="text-muted-foreground mt-1">
          Manage all orders submitted across the company.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>
            Orders must be marked as COMPLETED by an admin before commissions are paid out.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!orders || orders.length === 0 ? (
            <Empty 
              icon={ShoppingCart}
              title="No orders yet"
              description="Orders submitted by sales agents will appear here."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Details</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{order.orderName}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">#{order.id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.clientName}</div>
                    </TableCell>
                    <TableCell>{order.salesName}</TableCell>
                    <TableCell>{order.distributorName || "None"}</TableCell>
                    <TableCell>{format(parseISO(order.orderDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${order.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {order.status === "COMPLETED" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Clock className="mr-1 h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.status === "PENDING" && (
                        <Button 
                          size="sm" 
                          onClick={() => setConfirmCompleteId(order.id)}
                        >
                          Mark Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmCompleteId !== null} onOpenChange={(open) => !open && setConfirmCompleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Marking this order as completed will finalize it and generate commissions for the sales agent and their distributor based on current commission rates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmCompleteId && handleComplete(confirmCompleteId)}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? "Completing..." : "Complete Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
