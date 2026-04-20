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
import { Save, Percent, Package as PackageIcon, Plus, Trash2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
});

const packageSchema = z.object({
  name: z.string().min(2, "Name is required"),
  price: z.coerce.number().min(0),
  vatPct: z.coerce.number().min(0).max(100),
  isActive: z.boolean().default(true),
});

export default function AdminSettings() {
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
        toast({ title: "Commission rates updated successfully" });
        queryClient.setQueryData(getGetCommissionRatesQueryKey(), data);
      },
      onError: (err: ApiError<{ error?: string }>) => {
        toast({ title: "Error updating rates", description: err?.data?.error || "Unknown error", variant: "destructive" });
      }
    });
  }

  function onPkgSubmit(values: z.infer<typeof packageSchema>) {
    createPkg.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Package created successfully" });
        queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() });
        setIsPkgDialogOpen(false);
        pkgForm.reset();
      },
      onError: (err: ApiError<{ error?: string }>) => {
        toast({ title: "Error creating package", description: err?.data?.error || "Unknown error", variant: "destructive" });
      }
    });
  }

  function togglePkgActive(id: number, current: boolean) {
    updatePkg.mutate({ id, data: { isActive: !current } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() })
    });
  }

  function removePkg(id: number) {
    if (confirm('Are you sure you want to delete this package?')) {
      deletePkg.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Package deleted" });
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
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Configure global platform rules and packages.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="commissions">Commission Rates</TabsTrigger>
          <TabsTrigger value="packages">Packages Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="commissions" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" />Commission Rates</CardTitle>
              <CardDescription>These percentages apply to all new orders. Changing these values will not affect past commissions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="salesPct" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sales Agent Percentage</FormLabel>
                        <div className="relative"><FormControl><Input type="number" step="0.01" className="pr-8" {...field} /></FormControl><div className="absolute right-3 top-1/2 -translate-y-1/2">%</div></div>
                        <FormDescription>Earned by the sales agent submitting the order.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="distributorPct" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distributor Percentage</FormLabel>
                        <div className="relative"><FormControl><Input type="number" step="0.01" className="pr-8" {...field} /></FormControl><div className="absolute right-3 top-1/2 -translate-y-1/2">%</div></div>
                        <FormDescription>Earned by the distributor overseeing the sales agent.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" disabled={updateRates.isPending}>{updateRates.isPending ? "Saving..." : <><Save className="mr-2 h-4 w-4" />Save Settings</>}</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2"><PackageIcon className="h-5 w-5" /> Packages</CardTitle>
                <CardDescription>Manage packages and fixed pricing for orders.</CardDescription>
              </div>
              <Dialog open={isPkgDialogOpen} onOpenChange={setIsPkgDialogOpen}>
                <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/> Add Package</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Package</DialogTitle></DialogHeader>
                  <Form {...pkgForm}>
                    <form onSubmit={pkgForm.handleSubmit(onPkgSubmit)} className="space-y-4">
                      <FormField control={pkgForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Package Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={pkgForm.control} name="price" render={({ field }) => (
                          <FormItem><FormLabel>Price ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={pkgForm.control} name="vatPct" render={({ field }) => (
                          <FormItem><FormLabel>VAT (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={pkgForm.control} name="isActive" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 mt-4"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Active / Visible</FormLabel></FormItem>
                      )} />
                      <Button type="submit" className="w-full mt-4" disabled={createPkg.isPending}>Save Package</Button>
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
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>VAT (%)</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages?.map(pkg => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell>${Number(pkg.price).toFixed(2)}</TableCell>
                        <TableCell>{pkg.vatPct}%</TableCell>
                        <TableCell><Switch checked={pkg.isActive} onCheckedChange={() => togglePkgActive(pkg.id, pkg.isActive)} /></TableCell>
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
