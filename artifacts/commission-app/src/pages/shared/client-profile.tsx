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
import { useI18n } from "@/lib/i18n";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export default function ClientProfile() {
  const { t, locale } = useI18n();
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
          <h2 className="text-xl font-bold text-red-900">{t.clientProfile.clientNotFound}</h2>
          <p className="text-red-700 mt-2">{t.clientProfile.clientNotFoundDesc}</p>
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
            <Badge variant="outline" className="font-mono text-xs" dir="ltr">{client.taxCardNumber}</Badge>
            {isExpired ? (
              <Badge variant="destructive">{t.clientProfile.ownershipExpired}</Badge>
            ) : (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-transparent">
                {t.clientProfile.ownershipActive.replace("{days}", String(daysRemaining))}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t.clientProfile.overviewTab}</TabsTrigger>
          <TabsTrigger value="financial">{t.clientProfile.financialTab}</TabsTrigger>
          <TabsTrigger value="orders">{t.clientProfile.ordersTab}</TabsTrigger>
          <TabsTrigger value="history">{t.clientProfile.historyTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <UserSquare2 className="me-2 h-4 w-4" /> {t.clientProfile.contact}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center"><Mail className="me-3 h-4 w-4 text-muted-foreground"/> <span dir="ltr">{client.email}</span></p>
                  <p className="flex items-center"><Phone className="me-3 h-4 w-4 text-muted-foreground"/> <span dir="ltr">{client.phone1}</span> {client.phone1WhatsApp && '(WhatsApp)'}</p>
                  {client.phone2 && <p className="flex items-center"><Phone className="me-3 h-4 w-4 text-muted-foreground"/> <span dir="ltr">{client.phone2}</span> {client.phone2WhatsApp && '(WhatsApp)'}</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <Building2 className="me-2 h-4 w-4" /> {t.clientProfile.businessInfo}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">{t.clientProfile.type}:</span> {client.businessType}</p>
                  <p><span className="text-muted-foreground">{t.clientProfile.taxName}:</span> {client.taxCardName}</p>
                  <p><span className="text-muted-foreground">{t.clientProfile.crNumber}:</span> <span dir="ltr">{client.commercialRegistryNumber}</span></p>
                  <p><span className="text-muted-foreground">{t.clientProfile.authority}:</span> {client.issuingAuthority}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <MapPin className="me-2 h-4 w-4" /> {t.clientProfile.locationIdentity}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="flex items-start"><MapPin className="me-3 h-4 w-4 text-muted-foreground mt-0.5 shrink-0"/> <span className="line-clamp-3">{client.address}</span></p>
                  <p className="flex items-center mt-2"><Key className="me-3 h-4 w-4 text-muted-foreground"/> <span dir="ltr">{client.nationalId}</span></p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.clientProfile.subtotal}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {formatCurrency(profileData.financials?.subtotal ?? 0, locale)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.clientProfile.vatTotal}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {formatCurrency(profileData.financials?.vatTotal ?? 0, locale)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.clientProfile.collected}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-green-700">
                {formatCurrency(profileData.financials?.collectedTotal ?? 0, locale)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.clientProfile.outstanding}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-amber-700">
                {formatCurrency(profileData.financials?.outstandingTotal ?? 0, locale)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t.clientProfile.financialTimeline}</CardTitle>
              <CardDescription>{t.clientProfile.financialTimelineDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {!profileData.timeline || profileData.timeline.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t.clientProfile.noFinancialActivity}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.common.date}</TableHead>
                      <TableHead>{t.clientProfile.event}</TableHead>
                      <TableHead>{t.clientProfile.reference}</TableHead>
                      <TableHead>{t.common.status}</TableHead>
                      <TableHead className="text-right">{t.common.amount}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profileData.timeline.map((item, index) => (
                      <TableRow key={`${item.type}-${item.orderId ?? "none"}-${item.commissionId ?? "none"}-${index}`}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(item.occurredAt, locale)}</TableCell>
                        <TableCell className="font-medium">{item.details}</TableCell>
                        <TableCell dir="ltr" className={locale === "ar" ? "text-right" : "text-left"}>
                            {item.orderName ?? (item.orderId ? `#${item.orderId}` : "-")}
                        </TableCell>
                        <TableCell>
                          {item.commissionStatus ? (
                            <Badge variant={item.commissionStatus === "PAID" ? "default" : "secondary"} className={item.commissionStatus === "PAID" ? "bg-green-100 text-green-800" : ""}>
                              {t.commissionStatus[item.commissionStatus as keyof typeof t.commissionStatus] ?? item.commissionStatus}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {item.amount == null ? "-" : formatCurrency(item.amount, locale)}
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
              <CardTitle>{t.clientProfile.ordersDirectory}</CardTitle>
              <CardDescription>{t.clientProfile.ordersDirectoryDesc} {client.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {orders?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t.orders.noOrders}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.common.date}</TableHead>
                      <TableHead>{t.common.description}</TableHead>
                      <TableHead className="text-right">{t.common.amount}</TableHead>
                      <TableHead>{t.wizard.vat}</TableHead>
                      <TableHead>{t.clientProfile.receipt}</TableHead>
                      <TableHead>{t.common.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(o.createdAt, locale)}</TableCell>
                        <TableCell className="font-medium">{o.orderName}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCurrency(o.amount, locale)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatCurrency(o.vatAmount, locale)}</TableCell>
                        <TableCell><span dir="ltr">{o.receiptNumber || '-'}</span></TableCell>
                        <TableCell>
                          <Badge variant={o.status === "COMPLETED" || o.status === "COLLECTED" ? "default" : "secondary"} className={o.status === "COMPLETED" || o.status === "COLLECTED" ? "bg-green-100 text-green-800" : ""}>
                            {t.orderStatus[o.status as keyof typeof t.orderStatus] ?? o.status}
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
              <CardTitle>{t.clientProfile.assignmentHistoryTitle}</CardTitle>
              <CardDescription>{t.clientProfile.assignmentHistoryDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {isAssignmentsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : !assignments || assignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t.clientProfile.noAssignmentHistory}</p>
              ) : (
                <div className="space-y-4">
                  {assignments.map(a => (
                    <div key={a.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="bg-slate-100 p-2 rounded-full shrink-0">
                        <RefreshCw className="h-5 w-5 text-slate-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-600 mb-1">{formatDateTime(a.createdAt, locale)}</p>
                        <p className="font-medium text-slate-800">
                          {a.fromSalesName ? t.clientProfile.transferredFrom.replace("{from}", a.fromSalesName) : t.clientProfile.assignedInitiallyTo} 
                          {' '}
                          <span className="text-primary">{a.toSalesName}</span>
                        </p>
                        <p className="text-sm mt-1">{t.clientProfile.changedBy}: {a.changedByName}</p>
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
