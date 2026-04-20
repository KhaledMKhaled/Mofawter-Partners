import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useGetCommissionRates, 
  useUpdateCommissionRates,
  getGetCommissionRatesQueryKey,
  useListPackages,
  useCreatePackage,
  useUpdatePackage,
  useDeletePackage,
  getListPackagesQueryKey
} from "@workspace/api-client-react"
import { ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Percent, Package as PackageIcon, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ratesSchema = z.object({
  salesPct: z.coerce.number().min(0).max(100, "Percentage cannot exceed 100"),
  distributorPct: z.coerce.number().min(0).max(100, "Percentage cannot exceed 100"),
  commissionTriggerStatus: z.string().optional(),
});

const TRIGGER_STATUS_OPTIONS = [
  { value: "COLLECTED",          label: "Collected (default)" },
  { value: "EXECUTED",           label: "Executed" },
  { value: "IN_EXECUTION",       label: "In Execution" },
  { value: "APPROVED",           label: "Approved" },
  { value: "COMMISSION_PENDING", label: "Commission Pending" },
];

const packageSchema = z.object({
  name: z.string().min(2, "name_required"),
  price: z.coerce.number().min(0),
  vatPct: z.coerce.number().min(0).max(100),
  isActive: z.boolean().default(true),
});

export default function AdminSettings() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initRef = useRef<boolean>(false);
  const [activeTab, setActiveTab] = useState("commissions");
  const [isPkgDialogOpen, setIsPkgDialogOpen] = useState(false);

  // Queries
  const { data: rates, isLoading: ratesLoading } = useGetCommissionRates({
    query: { queryKey: getGetCommissionRatesQueryKey() }
  });
  
  const { data: packages, isLoading: pkgsLoading } = useListPackages({
    query: { queryKey: getListPackagesQueryKey(), enabled: activeTab === 'packages' }
  });

  // Mutations
  const updateRates = useUpdateCommissionRates();
  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage();
  const deletePkg = useDeletePackage();

  // Forms
  const form = useForm<z.infer<typeof ratesSchema>>({
    resolver: zodResolver(ratesSchema),
    defaultValues: { salesPct: 10, distributorPct: 5 },
  });

  const pkgForm = useForm<z.infer<typeof packageSchema>>({
    resolver: zodResolver(packageSchema),
    defaultValues: { name: "", price: 0, vatPct: 14, isActive: true },
  });

  useEffect(() => {
    if (rates && !initRef.current) {
      form.reset({
        salesPct: rates.salesPct,
        distributorPct: rates.distributorPct,
      });
      initRef.current = true;
    }
  }, [rates, form]);

  function onSubmit(values: z.infer<typeof ratesSchema>) {
    updateRates.mutate({ data: values }, {
      onSuccess: (data) => {
        toast({ title: t.adminSettings.ratesSuccess });
        queryClient.setQueryData(getGetCommissionRatesQueryKey(), data);
      },
      onError: (err: ApiError<{ error?: string }>) => {
        toast({ title: t.adminSettings.ratesError, description: err?.data?.error || "Unknown error", variant: "destructive" });
      }
    });
  }

  function onPkgSubmit(values: z.infer<typeof packageSchema>) {
    createPkg.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: t.adminSettings.pkgSuccess });
        queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
        setIsPkgDialogOpen(false);
        pkgForm.reset();
      },
      onError: (err: ApiError<{ error?: string }>) => {
        toast({ title: t.adminSettings.pkgError, description: err?.data?.error || "Unknown error", variant: "destructive" });
      }
    });
  }

  function togglePkgActive(id: number, current: boolean) {
    updatePkg.mutate({ id, data: { isActive: !current } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() })
    });
  }

  function removePkg(id: number) {
    if (confirm(t.adminSettings.deleteConfirm)) {
      deletePkg.mutate({ id }, {
        onSuccess: () => {
          toast({ title: t.adminSettings.pkgDeleted });
          queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
        }
      });
    }
  }

  if (ratesLoading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-64" /></div>
        <Card className="max-w-2xl"><CardContent className="p-6 space-y-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.adminSettings.title}</h2>
        <p className="text-muted-foreground mt-1">{t.adminSettings.subtitle}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="commissions">{t.adminSettings.tabCommissions}</TabsTrigger>
          <TabsTrigger value="packages">{t.adminSettings.tabPackages}</TabsTrigger>
        </TabsList>

        <TabsContent value="commissions" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" />{t.adminSettings.tabCommissions}</CardTitle>
              <CardDescription>{t.adminSettings.commRatesDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-start">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="salesPct" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.adminSettings.salesPctLabel}</FormLabel>
                        <div className="relative"><FormControl><Input type="number" step="0.01" className={t.common.dir === "rtl" ? "pl-8" : "pr-8"} {...field} /></FormControl><div className={`absolute top-1/2 -translate-y-1/2 ${t.common.dir === "rtl" ? "left-3" : "right-3"}`}>%</div></div>
                        <FormDescription>{t.adminSettings.salesPctDesc}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="distributorPct" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.adminSettings.distPctLabel}</FormLabel>
                        <div className="relative"><FormControl><Input type="number" step="0.01" className={t.common.dir === "rtl" ? "pl-8" : "pr-8"} {...field} /></FormControl><div className={`absolute top-1/2 -translate-y-1/2 ${t.common.dir === "rtl" ? "left-3" : "right-3"}`}>%</div></div>
                        <FormDescription>{t.adminSettings.distPctDesc}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" disabled={updateRates.isPending}>{updateRates.isPending ? t.adminSettings.saving : <><Save className="me-2 h-4 w-4" />{t.adminSettings.saveSettings}</>}</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center text-start">
              <div>
                <CardTitle className="flex items-center gap-2"><PackageIcon className="h-5 w-5" /> {t.adminSettings.packagesTitle}</CardTitle>
                <CardDescription>{t.adminSettings.packagesDesc}</CardDescription>
              </div>
              <Dialog open={isPkgDialogOpen} onOpenChange={setIsPkgDialogOpen}>
                <DialogTrigger asChild><Button><Plus className="me-2 h-4 w-4"/> {t.adminSettings.addPackageBtn}</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t.adminSettings.createPackageTitle}</DialogTitle></DialogHeader>
                  <Form {...pkgForm}>
                    <form onSubmit={pkgForm.handleSubmit(onPkgSubmit)} className="space-y-4 text-start">
                      <FormField control={pkgForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>{t.adminSettings.pkgNameLabel}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage>{pkgForm.formState.errors.name?.message === 'name_required' ? t.adminSettings.nameError : pkgForm.formState.errors.name?.message}</FormMessage></FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={pkgForm.control} name="price" render={({ field }) => (
                          <FormItem><FormLabel>{t.adminSettings.pkgPriceLabel}</FormLabel><FormControl><Input type="number" {...field} className={t.common.dir === "rtl" ? "text-right" : ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={pkgForm.control} name="vatPct" render={({ field }) => (
                          <FormItem><FormLabel>{t.adminSettings.pkgVatLabel}</FormLabel><FormControl><Input type="number" {...field} className={t.common.dir === "rtl" ? "text-right" : ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={pkgForm.control} name="isActive" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 mt-4"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">{t.adminSettings.pkgActiveLabel}</FormLabel></FormItem>
                      )} />
                      <Button type="submit" className="w-full mt-4" disabled={createPkg.isPending}>{t.adminSettings.savePackageBtn}</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {pkgsLoading ? <Skeleton className="h-32 w-full" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.adminSettings.nameTable}</TableHead>
                      <TableHead>{t.adminSettings.priceTable}</TableHead>
                      <TableHead>{t.adminSettings.vatTable}</TableHead>
                      <TableHead>{t.adminSettings.activeTable}</TableHead>
                      <TableHead className="text-right">{t.adminSettings.actionsTable}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages?.map(pkg => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell className="dir-ltr" dir="ltr">{formatCurrency(pkg.price, locale)}</TableCell>
                        <TableCell className="dir-ltr" dir="ltr">{pkg.vatPct}%</TableCell>
                        <TableCell><Switch checked={pkg.isActive} onCheckedChange={() => togglePkgActive(pkg.id, pkg.isActive)} className={t.common.dir === "rtl" ? "rotate-180" : ""} /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => removePkg(pkg.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
