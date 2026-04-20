import {
  useListClients,
} from "@workspace/api-client-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { UserSquare2 } from "lucide-react";
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

export default function DistributorClients() {
  const { data: clients, isLoading } = useListClients();

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
        <h2 className="text-3xl font-bold tracking-tight">Team Clients</h2>
        <p className="text-muted-foreground mt-1">
          All clients owned by your sales agents, with their 5-year ownership windows.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>
            Click a client to see their full 360° profile, orders, and commissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!clients || clients.length === 0 ? (
            <Empty
              icon={UserSquare2}
              title="No clients yet"
              description="Clients added by your sales agents will appear here."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax Card</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Sales Agent</TableHead>
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
                      <TableCell className="font-mono text-sm">
                        {client.taxCardNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          to={`/clients/${client.id}`}
                          className="text-primary hover:underline"
                        >
                          {client.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        #{client.assignedSalesId}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(client.ownershipStartDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {format(endDate, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800 hover:bg-blue-100"
                          >
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
