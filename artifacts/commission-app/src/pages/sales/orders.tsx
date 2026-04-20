import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useListOrders, 
  useListClients,
  useCreateOrder,
  getListOrdersQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react"
import { ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import { ShoppingCart, Plus, AlertCircle } from "lucide-react";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const orderSchema = z.object({
  clientId: z.coerce.number().min(1, "Please select a client"),
  orderName: z.string().min(2, "Order description is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

export default function SalesOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders, isLoading: isOrdersLoading } = useListOrders({
    query: { queryKey: getListOrdersQueryKey() }
  });

  const { data: clients, isLoading: isClientsLoading } = useListClients();

  const createOrder = useCreateOrder();

  const form = useForm<z.infer<typeof orderSchema>>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      clientId: 0,
      orderName: "",
      amount: 0,
    },
  });

  const selectedClientId = form.watch("clientId");
  const selectedClient = clients?.find(c => c.id === selectedClientId);
  
  let isExpired = false;
  if (selectedClient) {
    const endDate = parseISO(selectedClient.ownershipEndDate);
    isExpired = endDate < new Date();
  }

  function onSubmit(values: z.infer<typeof orderSchema>) {
    createOrder.mutate(
      { 
        data: values 
      },
      {
        onSuccess: () => {
          toast({ title: "Order submitted successfully" });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          form.reset({ clientId: 0, orderName: "", amount: 0 });
        },
        onError: (err: ApiError<{ error?: string }>) => {
          toast({
            title: "Error submitting order",
            description: err?.data?.error || "Unknown error",
            variant: "destructive"
          });
        }
      }
    );
  }

  if (isOrdersLoading || isClientsLoading) {
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
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
        <p className="text-muted-foreground mt-1">
          Submit new orders and view your order history.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Submit New Order</CardTitle>
              <CardDescription>Enter order details for an existing client</CardDescription>
            </CardHeader>
            <CardContent>
              {clients?.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  You must add a client before you can submit an order.
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value ? String(field.value) : undefined}
                            value={field.value ? String(field.value) : undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a client" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients?.map((client) => (
                                <SelectItem key={client.id} value={String(client.id)}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isExpired && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                          This client's ownership window has expired. Completing this order will not generate commissions.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <FormField
                      control={form.control}
                      name="orderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Description</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Website Redesign" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" placeholder="1000.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={createOrder.isPending || clients?.length === 0}>
                      {createOrder.isPending ? "Submitting..." : "Submit Order"}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
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
                        <TableCell>{order.clientName}</TableCell>
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
      </div>
    </div>
  );
}