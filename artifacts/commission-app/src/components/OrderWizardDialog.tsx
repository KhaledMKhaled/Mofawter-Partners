import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
 codex/add-unified-orders-endpoint
import { 
  useLookupClient, 
import {
  useLookupClient,
  useCreateClient,
main
  useListPackages,
  useCreateUnifiedOrder,
  getListOrdersQueryKey,
  getGetDashboardSummaryQueryKey,
  getListClientsQueryKey,
  getLookupClientQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, Package as PackageIcon, CheckCircle2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const TAX_CARD_DIGITS_ONLY_REGEX = /^\d+$/;
const TAX_CARD_DIGITS_ONLY_MESSAGE = "رقم البطاقة الضريبية يجب أن يحتوي على أرقام فقط";

const clientInfoSchema = z.object({
  name: z.string().min(2, "Client Name is required"),
  taxCardNumber: z
    .string()
    .min(1, "رقم البطاقة الضريبية مطلوب")
    .regex(TAX_CARD_DIGITS_ONLY_REGEX, TAX_CARD_DIGITS_ONLY_MESSAGE),
  taxCardName: z.string().min(2, "Tax Card Name is required"),
  issuingAuthority: z.string().min(2, "Issuing Authority is required"),
  commercialRegistryNumber: z.string().min(2, "Commercial Registry Number is required"),
  businessType: z.string().min(2, "Business Type is required"),
  email: z.string().email("Valid email is required"),
  phone1: z.string().min(5, "Phone is required"),
  phone1WhatsApp: z.boolean().default(false),
  phone2: z.string().optional(),
  phone2WhatsApp: z.boolean().default(false),
  nationalId: z.string().min(14, "National ID is required"),
  address: z.string().min(5, "Address is required"),
});

const orderInfoSchema = z.object({
  packageId: z.coerce.number().min(1, "Please select an active package"),
  receiptNumber: z.string().optional(),
  isFullyCollected: z.boolean().default(false),
});

export function OrderWizardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [taxCardSearch, setTaxCardSearch] = useState("");
  const [foundClient, setFoundClient] = useState<any>(null);
codex/add-unified-orders-endpoint
main
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lookupData, isLoading: isLookupLoading } = useLookupClient(
    { taxCardNumber: taxCardSearch },
    { query: { enabled: !!taxCardSearch, retry: false, queryKey: getLookupClientQueryKey({ taxCardNumber: taxCardSearch }) } }
  );

  const { data: packages } = useListPackages();

codex/add-unified-orders-endpoint
  // Mutations
  const createUnifiedOrder = useCreateUnifiedOrder();
  const createClient = useCreateClient();
  const createOrder = useCreateOrder();
main

  const clientForm = useForm<z.infer<typeof clientInfoSchema>>({
    resolver: zodResolver(clientInfoSchema),
    defaultValues: {
      name: "",
      taxCardNumber: "",
      taxCardName: "",
      issuingAuthority: "",
      commercialRegistryNumber: "",
      businessType: "",
      email: "",
      phone1: "",
      phone1WhatsApp: false,
      phone2: "",
      phone2WhatsApp: false,
      nationalId: "",
      address: "",
    },
  });

  const orderForm = useForm<z.infer<typeof orderInfoSchema>>({
    resolver: zodResolver(orderInfoSchema),
    defaultValues: {
      packageId: 0,
      receiptNumber: "",
      isFullyCollected: false,
    },
  });

  const resetWizard = () => {
    setTaxCardSearch("");
    setFoundClient(null);
    taxForm.reset();
    clientForm.reset();
    orderForm.reset();
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) resetWizard();
    onOpenChange(o);
  };

  useEffect(() => {
    if (!lookupData || !taxCardSearch) return;

    if (lookupData.found && lookupData.client) {
      setFoundClient(lookupData.client);
      clientForm.reset({
        name: lookupData.client.name || "",
        taxCardNumber: lookupData.client.taxCardNumber || taxCardSearch,
        taxCardName: lookupData.client.taxCardName || "",
        issuingAuthority: lookupData.client.issuingAuthority || "",
        commercialRegistryNumber: lookupData.client.commercialRegistryNumber || "",
        businessType: lookupData.client.businessType || "",
        email: lookupData.client.email || "",
        phone1: lookupData.client.phone1 || "",
        phone1WhatsApp: !!lookupData.client.phone1WhatsApp,
        phone2: lookupData.client.phone2 || "",
        phone2WhatsApp: !!lookupData.client.phone2WhatsApp,
        nationalId: lookupData.client.nationalId || "",
        address: lookupData.client.address || "",
      });
      return;
    }
  }

  const onClientSubmit = (_values: z.infer<typeof clientInfoSchema>) => {
    setStep(3);
  };

    setFoundClient(null);
    clientForm.setValue("taxCardNumber", taxCardSearch, { shouldValidate: true });
  }, [lookupData, taxCardSearch, clientForm]);

  const activePackageId = orderForm.watch("packageId");
  const selectedPkg = packages?.find(p => p.id === activePackageId);
  
  const finishOrder = () => {
    const values = orderForm.getValues();
    
    createUnifiedOrder.mutate({
      data: {
        taxCardNumber: foundClient?.taxCardNumber || clientForm.getValues().taxCardNumber,
        client: foundClient ? undefined : clientForm.getValues(),
        packageId: values.packageId,
        receiptNumber: values.receiptNumber,
        isFullyCollected: values.isFullyCollected
      }
    }, {
      onSuccess: () => {
        toast({ title: "Order created successfully" });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        handleOpenChange(false);
      },
      onError: (err: any) => {
        toast({ title: "Error creating order", description: err?.data?.error || "Unknown error", variant: "destructive" });
  const selectedPkg = packages?.find((p: any) => p.id === activePackageId);

  const isPendingOrderBlocked = !!lookupData?.found && !!lookupData?.hasPendingOrder;

  const triggerLookup = (value: string) => {
    const normalizedValue = value.trim().replace(/\s+/g, "");
    clientForm.setValue("taxCardNumber", normalizedValue, { shouldValidate: true });
    if (normalizedValue.length >= 5) {
      setTaxCardSearch(normalizedValue);
      return;
    }

    setTaxCardSearch("");
    setFoundClient(null);
  };

  const onCreateOrder = async () => {
    const isClientValid = foundClient ? true : await clientForm.trigger();
    const isOrderValid = await orderForm.trigger();

    if (!isClientValid || !isOrderValid) {
      toast({ title: "Please complete required fields before creating order.", variant: "destructive" });
      return;
    }

    if (isPendingOrderBlocked) {
      toast({ title: "Client has a pending order", variant: "destructive" });
      return;
    }

    try {
      let clientId = foundClient?.id;
      if (!clientId) {
        const createdClient = await createClient.mutateAsync({ data: clientForm.getValues() });
        clientId = createdClient.id;
      }

      const orderValues = orderForm.getValues();
      await createOrder.mutateAsync({
        data: {
          clientId,
          packageId: orderValues.packageId,
          receiptNumber: orderValues.receiptNumber,
          isFullyCollected: orderValues.isFullyCollected,
        },
      });

      toast({ title: "Order created successfully" });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      handleOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error creating order", description: err?.data?.error || "Unknown error", variant: "destructive" });
    }
  };

  const isSubmitting = createClient.isPending || createOrder.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unified Order Creation</DialogTitle>
          <DialogDescription>Client information and order details in one page.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Tax Card Lookup</AlertTitle>
            <AlertDescription>
              Enter tax card number. Lookup runs automatically while typing or on blur.
            </AlertDescription>
          </Alert>

          <Form {...clientForm}>
            <div className="space-y-6">
              <FormField
                control={clientForm.control}
                name="taxCardNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Card Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أدخل رقم البطاقة الضريبية"
                        inputMode="numeric"
                        pattern="\d*"
                        {...field}
                        onChange={(e) => {
                          const digitsOnlyValue = e.target.value.replace(/\D+/g, "");
                          field.onChange(digitsOnlyValue);
                          triggerLookup(digitsOnlyValue);
                        }}
                        onKeyDown={(e) => {
                          if (["e", "E", "+", "-", "."].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onPaste={(e) => {
                          const pastedText = e.clipboardData.getData("text");
                          if (/\D/.test(pastedText)) {
                            e.preventDefault();
                            const digitsOnlyValue = pastedText.replace(/\D+/g, "");
                            field.onChange(digitsOnlyValue);
                            triggerLookup(digitsOnlyValue);
                          }
                        }}
                        onBlur={(e) => {
                          field.onBlur();
                          triggerLookup(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isLookupLoading && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Looking up client...</AlertDescription>
                </Alert>
              )}

              {isPendingOrderBlocked && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Blocked</AlertTitle>
                  <AlertDescription>
                    This client ({lookupData?.client?.name}) already has a pending order and cannot create a new order now.
                  </AlertDescription>
                </Alert>
              )}

              {foundClient && !isPendingOrderBlocked && (
                <Alert className="bg-blue-50 border-blue-200">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Existing Client Loaded</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Using client: <strong>{foundClient.name}</strong>
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-slate-50 p-4 rounded-md">
                <h3 className="font-semibold text-lg flex items-center mb-4">
                  <Building2 className="mr-2 h-5 w-5" /> Client Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={clientForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Trade Name</FormLabel><FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientForm.control} name="taxCardName" render={({ field }) => (
                    <FormItem><FormLabel>Tax Card Name</FormLabel><FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientForm.control} name="issuingAuthority" render={({ field }) => (
                    <FormItem><FormLabel>Issuing Authority</FormLabel><FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientForm.control} name="commercialRegistryNumber" render={({ field }) => (
                    <FormItem><FormLabel>Commercial Registry Num</FormLabel><FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientForm.control} name="businessType" render={({ field }) => (
                    <FormItem><FormLabel>Business Type</FormLabel><FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientForm.control} name="nationalId" render={({ field }) => (
                    <FormItem><FormLabel>National ID</FormLabel><FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={clientForm.control} name="address" render={({ field }) => (
                    <FormItem><FormLabel>Full Address</FormLabel><FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField control={clientForm.control} name="phone1" render={({ field }) => (
                    <FormItem><FormLabel>Phone 1</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl>
                        <FormField control={clientForm.control} name="phone1WhatsApp" render={({ field: wField }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Switch checked={wField.value} onCheckedChange={wField.onChange} disabled={!!foundClient} />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">WhatsApp</FormLabel>
                          </FormItem>
                        )} />
                      </div>
                      <FormMessage /></FormItem>
                  )} />

                  <FormField control={clientForm.control} name="phone2" render={({ field }) => (
                    <FormItem><FormLabel>Phone 2</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl><Input {...field} readOnly={!!foundClient} className={foundClient ? "bg-muted" : ""} /></FormControl>
                        <FormField control={clientForm.control} name="phone2WhatsApp" render={({ field: wField }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Switch checked={wField.value} onCheckedChange={wField.onChange} disabled={!!foundClient} />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">WhatsApp</FormLabel>
                          </FormItem>
                        )} />
                      </div>
                      <FormMessage /></FormItem>
                  )} />
                </div>
              </div>
            </div>
          </Form>

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                    <Button type="submit">
                      Save and Continue
                    </Button>
          <Form {...orderForm}>
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center">
                <PackageIcon className="mr-2 h-5 w-5" /> Order Information
              </h3>

              <FormField control={orderForm.control} name="packageId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Package</FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                    {packages?.filter((p: any) => p.isActive).map((pkg: any) => (
                      <Card
                        key={pkg.id}
                        className={`cursor-pointer transition-all ${field.value === pkg.id ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-slate-300"}`}
                        onClick={() => field.onChange(pkg.id)}
                      >
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                          <PackageIcon className="h-8 w-8 mb-2 text-slate-400" />
                          <h4 className="font-semibold text-lg">{pkg.name}</h4>
                          <p className="text-xl font-bold mt-2">${pkg.price}</p>
                          <Badge variant="secondary" className="mt-2">VAT {pkg.vatPct}%</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <FormMessage className="mt-2" />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <FormField control={orderForm.control} name="receiptNumber" render={({ field }) => (
                  <FormItem><FormLabel>Receipt Number (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={orderForm.control} name="isFullyCollected" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Fully Collected</FormLabel>
                      <p className="text-xs text-muted-foreground">Mark if full payment was received.</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              {selectedPkg && (
                <Card>
                  <CardContent className="p-4 space-y-2 text-sm">
                    <p><strong>Selected Package:</strong> {selectedPkg.name}</p>
                    <p><strong>Total with VAT:</strong> ${(Number(selectedPkg.price) * (1 + Number(selectedPkg.vatPct) / 100)).toFixed(2)}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </Form>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={finishOrder} disabled={createUnifiedOrder.isPending}>
                <Check className="mr-2 h-4 w-4" />
                {createUnifiedOrder.isPending ? "Submitting..." : "Confirm & Submit Order"}
              </Button>
            </div>
          <div className="flex justify-end pt-2">
            <Button onClick={onCreateOrder} disabled={isSubmitting || isPendingOrderBlocked || !clientForm.watch("taxCardNumber")}>
              {isSubmitting ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
