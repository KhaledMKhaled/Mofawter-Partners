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
import { useI18n } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/format";

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
  const { t, locale } = useI18n();
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
        <h2 className="text-3xl font-bold tracking-tight">{t.adminClients.title}</h2>
        <p className="text-muted-foreground mt-1">
          {t.adminClients.subtitle}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.adminClients.allClients}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!clients || clients.length === 0 ? (
            <Empty
              icon={UserSquare2}
              title={t.adminClients.noClients}
              description={t.adminClients.noClientsDesc}
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.adminClients.clientTable}</TableHead>
                  <TableHead>{t.adminClients.salesAgentTable}</TableHead>
                  <TableHead>{t.adminClients.distributorTable}</TableHead>
                  <TableHead>{t.adminClients.ownershipEndsTable}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
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
                        <div className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">
                          {client.taxCardNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sales?.name ?? <span dir="ltr">#{client.assignedSalesId}</span>}
                      </TableCell>
                      <TableCell>
                        {distributor?.name ??
                          <span dir="ltr">#{client.assignedDistributorId}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="whitespace-nowrap">{formatDate(client.ownershipEndDate, locale)}</span>
                          {isExpired ? (
                            <Badge variant="destructive" className="w-fit">
                              {t.adminClients.expired}
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="w-fit bg-blue-100 text-blue-800 hover:bg-blue-100"
                            >
                              {t.adminClients.daysRemaining.replace("{days}", String(daysRemaining))}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHistoryClient(client)}
                          >
                            <History className="me-2 h-4 w-4" />
                            {t.adminClients.historyBtn}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openReassign(client)}
                          >
                            <ArrowRightLeft className="me-2 h-4 w-4" />
                            {t.adminClients.reassignBtn}
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
            <DialogTitle>{t.adminClients.reassignTitle}</DialogTitle>
            <DialogDescription>
              {t.adminClients.reassignDesc.replace("{name}", reassignClient?.name || "")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-start">
            <div className="text-sm text-muted-foreground">
              {t.adminClients.currentlyAssigned}{" "}
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
                <SelectValue placeholder={t.adminClients.chooseAgent} />
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
              {t.common.cancel}
            </Button>
            <Button
              onClick={submitReassign}
              disabled={
                reassign.isPending ||
                !selectedSalesId ||
                Number(selectedSalesId) === reassignClient?.assignedSalesId
              }
            >
              {reassign.isPending ? t.adminClients.reassigning : t.adminClients.reassignBtn}
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
  const { t, locale } = useI18n();
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
          <DialogTitle>{t.adminClients.historyTitle}</DialogTitle>
          <DialogDescription>
            {t.adminClients.historyDesc.replace("{name}", client?.name || "")}
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
              title={t.adminClients.noHistory}
              description={t.adminClients.noHistoryDesc}
              className="py-8"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.adminClients.when}</TableHead>
                  <TableHead>{t.adminClients.from}</TableHead>
                  <TableHead>{t.adminClients.to}</TableHead>
                  <TableHead>{t.adminClients.by}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(entry.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>
                          {entry.fromSalesName ??
                            (entry.fromSalesId
                              ? <span dir="ltr">#{entry.fromSalesId}</span>
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
                          {entry.toSalesName ?? <span dir="ltr">#{entry.toSalesId}</span>}
                        </span>
                        {entry.toDistributorName && (
                          <span className="text-xs text-muted-foreground">
                            {entry.toDistributorName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.changedByName ?? <span dir="ltr">#{entry.changedById}</span>}
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
