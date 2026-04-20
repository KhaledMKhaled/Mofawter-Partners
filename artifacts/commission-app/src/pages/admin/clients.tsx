import { useState } from "react";
import {
  useListClients,
  useListUsers,
  useReassignClient,
  useListClientAssignments,
  getListClientsQueryKey,
  getListClientAssignmentsQueryKey,
  Role,
  type Client,
  type User,
  type ApiError,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import { UserSquare2, ArrowRightLeft, History } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

function userMap(users: User[] | undefined) {
  const map = new Map<number, User>();
  (users ?? []).forEach((u) => map.set(u.id, u));
  return map;
}

export default function AdminClients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading: isClientsLoading } = useListClients();
  const { data: users } = useListUsers();

  const usersById = userMap(users);
  const salesAgents = (users ?? []).filter((u) => u.role === Role.SALES);

  const [reassignClient, setReassignClient] = useState<Client | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [selectedSalesId, setSelectedSalesId] = useState<string>("");

  const reassign = useReassignClient();

  function openReassign(client: Client) {
    setReassignClient(client);
    setSelectedSalesId(String(client.assignedSalesId));
  }

  function submitReassign() {
    if (!reassignClient || !selectedSalesId) return;
    const newId = Number(selectedSalesId);
    if (newId === reassignClient.assignedSalesId) {
      setReassignClient(null);
      return;
    }
    reassign.mutate(
      { id: reassignClient.id, data: { assignedSalesId: newId } },
      {
        onSuccess: () => {
          toast({ title: "Client reassigned" });
          queryClient.invalidateQueries({
            queryKey: getListClientsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getListClientAssignmentsQueryKey(reassignClient.id),
          });
          setReassignClient(null);
        },
        onError: (err: ApiError<{ error?: string }>) => {
          toast({
            title: "Reassignment failed",
            description: err?.data?.error || "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  }

  if (isClientsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Clients</h2>
        <p className="text-muted-foreground mt-1">
          View all clients across the company. Reassign a client to a different
          sales agent without resetting their 5-year ownership window.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!clients || clients.length === 0 ? (
            <Empty
              icon={UserSquare2}
              title="No clients"
              description="Sales agents and distributors can add clients."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Sales agent</TableHead>
                  <TableHead>Distributor</TableHead>
                  <TableHead>Ownership ends</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const endDate = parseISO(client.ownershipEndDate);
                  const today = new Date();
                  const isExpired = endDate < today;
                  const daysRemaining = differenceInDays(endDate, today);
                  const sales = usersById.get(client.assignedSalesId);
                  const distributor = usersById.get(
                    client.assignedDistributorId,
                  );
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/clients/${client.id}`}
                          className="text-primary hover:underline"
                        >
                          {client.name}
                        </Link>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {client.taxCardNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sales?.name ?? `#${client.assignedSalesId}`}
                      </TableCell>
                      <TableCell>
                        {distributor?.name ??
                          `#${client.assignedDistributorId}`}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{format(endDate, "MMM d, yyyy")}</span>
                          {isExpired ? (
                            <Badge variant="destructive" className="w-fit">
                              Expired
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="w-fit bg-blue-100 text-blue-800 hover:bg-blue-100"
                            >
                              {daysRemaining} days remaining
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHistoryClient(client)}
                          >
                            <History className="mr-2 h-4 w-4" />
                            History
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openReassign(client)}
                          >
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Reassign
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!reassignClient}
        onOpenChange={(open) => !open && setReassignClient(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign client</DialogTitle>
            <DialogDescription>
              Move <strong>{reassignClient?.name}</strong> to another sales
              agent. The original 5-year ownership window is preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Currently assigned to{" "}
              <strong>
                {reassignClient
                  ? usersById.get(reassignClient.assignedSalesId)?.name ??
                    `#${reassignClient.assignedSalesId}`
                  : ""}
              </strong>
            </div>
            <Select
              value={selectedSalesId}
              onValueChange={setSelectedSalesId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a sales agent" />
              </SelectTrigger>
              <SelectContent>
                {salesAgents.map((agent) => {
                  const dist = agent.distributorId
                    ? usersById.get(agent.distributorId)?.name
                    : null;
                  return (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.name}
                      {dist ? ` — ${dist}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReassignClient(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitReassign}
              disabled={
                reassign.isPending ||
                !selectedSalesId ||
                Number(selectedSalesId) === reassignClient?.assignedSalesId
              }
            >
              {reassign.isPending ? "Reassigning..." : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientHistoryDialog
        client={historyClient}
        onClose={() => setHistoryClient(null)}
      />
    </div>
  );
}

function ClientHistoryDialog({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}) {
  const { data: history, isLoading } = useListClientAssignments(
    client?.id ?? 0,
    {
      query: {
        enabled: !!client,
        queryKey: client
          ? getListClientAssignmentsQueryKey(client.id)
          : ["client-assignments", "none"],
      },
    },
  );

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reassignment history</DialogTitle>
          <DialogDescription>
            Audit log of every reassignment for{" "}
            <strong>{client?.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !history || history.length === 0 ? (
            <Empty
              icon={History}
              title="No reassignments yet"
              description="This client has not been reassigned since being added."
              className="py-8"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(entry.createdAt), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {entry.fromSalesName ??
                            (entry.fromSalesId
                              ? `#${entry.fromSalesId}`
                              : "—")}
                        </span>
                        {entry.fromDistributorName && (
                          <span className="text-xs text-muted-foreground">
                            {entry.fromDistributorName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {entry.toSalesName ?? `#${entry.toSalesId}`}
                        </span>
                        {entry.toDistributorName && (
                          <span className="text-xs text-muted-foreground">
                            {entry.toDistributorName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.changedByName ?? `#${entry.changedById}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
