import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useListClients, 
  useCreateClient,
  getListClientsQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import { UserSquare2, Plus } from "lucide-react";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const clientSchema = z.object({
  name: z.string().min(2, "Name is required"),
});

export default function SalesClients() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useListClients({
    query: { queryKey: getListClientsQueryKey() }
  });

  const createClient = useCreateClient();

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
    },
  });

  function onSubmit(values: z.infer<typeof clientSchema>) {
    createClient.mutate(
      { 
        data: values 
      },
      {
        onSuccess: () => {
          toast({ title: "Client added successfully" });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setIsDialogOpen(false);
          form.reset();
        },
        onError: (err: any) => {
          toast({
            title: "Error adding client",
            description: err?.data?.error || "Unknown error",
            variant: "destructive"
          });
        }
      }
    );
  }

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
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Clients</h2>
          <p className="text-muted-foreground mt-1">
            Manage your assigned clients and their ownership windows.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Assign a new client to yourself. You will earn commissions on their orders during the ownership window.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="pt-4 flex justify-end">
                  <Button type="button" variant="outline" className="mr-2" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createClient.isPending}>
                    {createClient.isPending ? "Adding..." : "Add Client"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!clients || clients.length === 0 ? (
            <Empty 
              icon={UserSquare2}
              title="No clients"
              description="Get started by adding a client."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Ownership Started</TableHead>
                  <TableHead>Ownership Ends</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const endDate = parseISO(client.ownershipEndDate);
                  const today = new Date();
                  const isExpired = endDate < today;
                  const daysRemaining = differenceInDays(endDate, today);

                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{format(parseISO(client.ownershipStartDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{format(endDate, 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">Ownership expired</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            {daysRemaining} days remaining
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}