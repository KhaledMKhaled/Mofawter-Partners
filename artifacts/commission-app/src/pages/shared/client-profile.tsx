import { useState } from "react";
import { useParams } from "wouter";
import { 
  useGetClientProfile, 
  useListClientAssignments,
  getGetClientProfileQueryKey,
  getListClientAssignmentsQueryKey 
} from "@workspace/api-client-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { 
  UserSquare2, Phone, Mail, Building2, MapPin, BadgeAlert, History, Key, RefreshCw 
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: profileData, isLoading: isProfileLoading, error: profileError } = useGetClientProfile(clientId, {
    query: { enabled: !!clientId, queryKey: getGetClientProfileQueryKey(clientId) }
  });

  const { data: assignments, isLoading: isAssignmentsLoading } = useListClientAssignments(clientId, {
    query: { enabled: !!clientId && activeTab === 'history', queryKey: getListClientAssignmentsQueryKey(clientId) }
  });

  if (isProfileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  if (profileError || !profileData?.client) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6 text-center">
          <BadgeAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-red-900">Client Not Found</h2>
          <p className="text-red-700 mt-2">The client you requested cannot be found or you do not have permission to view it.</p>
        </CardContent>
      </Card>
    );
  }

  const { client, orders } = profileData;
  const endDate = parseISO(client.ownershipEndDate);
  const isExpired = endDate < new Date();
  const daysRemaining = differenceInDays(endDate, new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{client.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="font-mono text-xs">{client.taxCardNumber}</Badge>
            {isExpired ? (
              <Badge variant="destructive">Ownership Expired</Badge>
            ) : (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-transparent">
                Ownership active ({daysRemaining} days)
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview (360°)</TabsTrigger>
          <TabsTrigger value="financial">Financial 360</TabsTrigger>
          <TabsTrigger value="orders">Network Orders</TabsTrigger>
          <TabsTrigger value="history">Assignment History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <UserSquare2 className="mr-2 h-4 w-4" /> Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center"><Mail className="mr-3 h-4 w-4 text-muted-foreground"/> {client.email}</p>
                  <p className="flex items-center"><Phone className="mr-3 h-4 w-4 text-muted-foreground"/> {client.phone1} {client.phone1WhatsApp && '(WhatsApp)'}</p>
                  {client.phone2 && <p className="flex items-center"><Phone className="mr-3 h-4 w-4 text-muted-foreground"/> {client.phone2} {client.phone2WhatsApp && '(WhatsApp)'}</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <Building2 className="mr-2 h-4 w-4" /> Business Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Type:</span> {client.businessType}</p>
                  <p><span className="text-muted-foreground">Tax Name:</span> {client.taxCardName}</p>
                  <p><span className="text-muted-foreground">CR Number:</span> {client.commercialRegistryNumber}</p>
                  <p><span className="text-muted-foreground">Authority:</span> {client.issuingAuthority}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <MapPin className="mr-2 h-4 w-4" /> Location & Identity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="flex items-start"><MapPin className="mr-3 h-4 w-4 text-muted-foreground mt-0.5 shrink-0"/> <span className="line-clamp-3">{client.address}</span></p>
                  <p className="flex items-center mt-2"><Key className="mr-3 h-4 w-4 text-muted-foreground"/> {client.nationalId}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Subtotal</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                ${Number(profileData.financials?.subtotal ?? 0).toFixed(2)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">VAT Total</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                ${Number(profileData.financials?.vatTotal ?? 0).toFixed(2)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Collected</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-green-700">
                ${Number(profileData.financials?.collectedTotal ?? 0).toFixed(2)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-amber-700">
                ${Number(profileData.financials?.outstandingTotal ?? 0).toFixed(2)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Financial Timeline</CardTitle>
              <CardDescription>All monetary events linked to this client.</CardDescription>
            </CardHeader>
            <CardContent>
              {!profileData.timeline || profileData.timeline.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No financial activity found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profileData.timeline.map((item, index) => (
                      <TableRow key={`${item.type}-${item.orderId ?? "none"}-${item.commissionId ?? "none"}-${index}`}>
                        <TableCell>{format(parseISO(item.occurredAt), 'MMM d, yyyy p')}</TableCell>
                        <TableCell className="font-medium">{item.details}</TableCell>
                        <TableCell>{item.orderName ?? (item.orderId ? `Order #${item.orderId}` : "-")}</TableCell>
                        <TableCell>
                          {item.commissionStatus ? (
                            <Badge variant={item.commissionStatus === "PAID" ? "default" : "secondary"} className={item.commissionStatus === "PAID" ? "bg-green-100 text-green-800" : ""}>
                              {item.commissionStatus}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.amount == null ? "-" : `$${Number(item.amount).toFixed(2)}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Orders Directory</CardTitle>
              <CardDescription>Summary of all past and processing orders for {client.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {orders?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No orders found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>VAT</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map(o => (
                      <TableRow key={o.id}>
                        <TableCell>{format(parseISO(o.createdAt), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{o.orderName}</TableCell>
                        <TableCell className="text-right">${Number(o.amount).toFixed(2)}</TableCell>
                        <TableCell>${Number(o.vatAmount).toFixed(2)}</TableCell>
                        <TableCell>{o.receiptNumber || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={o.status === "COMPLETED" ? "default" : "secondary"} className={o.status === "COMPLETED" ? "bg-green-100 text-green-800" : ""}>
                            {o.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Assignment History</CardTitle>
              <CardDescription>View the transfer log of this client across sales agents.</CardDescription>
            </CardHeader>
            <CardContent>
              {isAssignmentsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : !assignments || assignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No assignment history found.</p>
              ) : (
                <div className="space-y-4">
                  {assignments.map(a => (
                    <div key={a.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="bg-slate-100 p-2 rounded-full">
                        <RefreshCw className="h-5 w-5 text-slate-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-600 mb-1">{format(parseISO(a.createdAt), 'PPpp')}</p>
                        <p className="font-medium text-slate-800">
                          {a.fromSalesName ? `Transferred from ${a.fromSalesName}` : 'Assigned initially'} 
                          {' to '}
                          <span className="text-primary">{a.toSalesName}</span>
                        </p>
                        <p className="text-sm mt-1">Changed by: {a.changedByName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
      </Tabs>
    </div>
  );
}
