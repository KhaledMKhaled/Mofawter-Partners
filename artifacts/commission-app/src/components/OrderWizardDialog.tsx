import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useLookupClient, 
  useCreateClient,
  useListPackages,
  useCreateOrder,
  getListOrdersQueryKey,
  getGetDashboardSummaryQueryKey,
  getListClientsQueryKey,
  getLookupClientQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, AlertCircle, Building2, Package as PackageIcon, CheckCircle2 } from "lucide-react";

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

type Step = 1 | 2 | 3 | 4;

const taxLookupSchema = z.object({
  taxCardNumber: z.string().min(5, "Tax Card Number is required"),
});

const clientInfoSchema = z.object({
  name: z.string().min(2, "Client Name is required"),
  taxCardNumber: z.string().min(2, "Tax Card requires a value"),
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

export function OrderWizardDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<Step>(1);
  const [taxCardSearch, setTaxCardSearch] = useState("");
  const [foundClient, setFoundClient] = useState<any>(null);
  const [newClientId, setNewClientId] = useState<number | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: lookupData, isLoading: isLookupLoading } = useLookupClient(
    { taxCardNumber: taxCardSearch },
    { query: { enabled: !!taxCardSearch, retry: false, queryKey: getLookupClientQueryKey({ taxCardNumber: taxCardSearch }) } }
  );
  
  const { data: packages } = useListPackages();

  // Mutations
  const createClient = useCreateClient();
  const createOrder = useCreateOrder();

  // Forms
  const taxForm = useForm<z.infer<typeof taxLookupSchema>>({
    resolver: zodResolver(taxLookupSchema),
    defaultValues: { taxCardNumber: "" },
  });

  const clientForm = useForm<z.infer<typeof clientInfoSchema>>({
    resolver: zodResolver(clientInfoSchema),
    defaultValues: {
      name: "", taxCardNumber: "", taxCardName: "", issuingAuthority: "",
      commercialRegistryNumber: "", businessType: "", email: "", phone1: "",
      phone1WhatsApp: false, phone2: "", phone2WhatsApp: false, nationalId: "", address: ""
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
    setStep(1);
    setTaxCardSearch("");
    setFoundClient(null);
    setNewClientId(null);
    taxForm.reset();
    clientForm.reset();
    orderForm.reset();
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) resetWizard();
    onOpenChange(o);
  };

  const onTaxSubmit = async (values: z.infer<typeof taxLookupSchema>) => {
    setTaxCardSearch(values.taxCardNumber);
  };

  // Wait for lookup result
  if (taxCardSearch && !isLookupLoading && lookupData) {
    if (lookupData.found && lookupData.hasPendingOrder) {
      // BLOCK
    } else if (lookupData.found && !lookupData.hasPendingOrder && step === 1) {
      // Existing client -> Move to Step 3
      setFoundClient(lookupData.client);
      setStep(3);
      setTaxCardSearch("");
    } else if (!lookupData.found && step === 1) {
      // New Client -> Move to Step 2
      clientForm.setValue("taxCardNumber", taxCardSearch);
      setStep(2);
      setTaxCardSearch("");
    }
  }

  const onClientSubmit = (values: z.infer<typeof clientInfoSchema>) => {
    createClient.mutate({ data: values }, {
      onSuccess: (res) => {
        setNewClientId(res.id);
        setStep(3);
      },
      onError: (err: any) => {
        toast({ title: "Error creating client", description: err?.data?.error || "Unknown error", variant: "destructive" });
      }
    });
  };

  const onOrderSubmit = (values: z.infer<typeof orderInfoSchema>) => {
    setStep(4);
  };

  const activeClientId = foundClient?.id || newClientId;
  const activePackageId = orderForm.watch("packageId");
  const selectedPkg = packages?.find(p => p.id === activePackageId);
  
  const finishOrder = () => {
    const values = orderForm.getValues();
    if (!activeClientId) return;
    
    createOrder.mutate({
      data: {
        clientId: activeClientId,
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
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unified Order Creation</DialogTitle>
          <DialogDescription>
            Step {step} of 4 
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: TAX LOOKUP */}
        {step === 1 && (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Tax Card Lookup</AlertTitle>
              <AlertDescription>
                Enter the client's tax card number. If the client exists and has a pending order, they will be blocked from creating a new order.
              </AlertDescription>
            </Alert>
            <Form {...taxForm}>
              <form onSubmit={taxForm.handleSubmit(onTaxSubmit)} className="space-y-4">
                <FormField
                  control={taxForm.control}
                  name="taxCardNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Card Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter 123-456-789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLookupLoading}>
                  {isLookupLoading ? "Lookuping up..." : "Next"}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>

            {lookupData?.found && lookupData?.hasPendingOrder && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Blocked</AlertTitle>
                <AlertDescription>
                  This client ({lookupData.client?.name}) already has a PENDING order. A new order cannot be created until the existing order is completed.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* STEP 2: CLIENT INFO */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-md">
              <h3 className="font-semibold text-lg flex items-center mb-4">
                <Building2 className="mr-2 h-5 w-5" /> Client Information
              </h3>
              <Form {...clientForm}>
                <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={clientForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Trade Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={clientForm.control} name="taxCardNumber" render={({ field }) => (
                      <FormItem><FormLabel>Tax Card Number</FormLabel><FormControl><Input {...field} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={clientForm.control} name="taxCardName" render={({ field }) => (
                      <FormItem><FormLabel>Tax Card Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={clientForm.control} name="issuingAuthority" render={({ field }) => (
                      <FormItem><FormLabel>Issuing Authority</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={clientForm.control} name="commercialRegistryNumber" render={({ field }) => (
                      <FormItem><FormLabel>Commercial Registry Num</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={clientForm.control} name="businessType" render={({ field }) => (
                      <FormItem><FormLabel>Business Type</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={clientForm.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={clientForm.control} name="nationalId" render={({ field }) => (
                      <FormItem><FormLabel>National ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={clientForm.control} name="address" render={({ field }) => (
                      <FormItem><FormLabel>Full Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={clientForm.control} name="phone1" render={({ field }) => (
                      <FormItem><FormLabel>Phone 1</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl><Input {...field} /></FormControl>
                          <FormField control={clientForm.control} name="phone1WhatsApp" render={({ field: wField }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Switch checked={wField.value} onCheckedChange={wField.onChange} />
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
                          <FormControl><Input {...field} /></FormControl>
                          <FormField control={clientForm.control} name="phone2WhatsApp" render={({ field: wField }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Switch checked={wField.value} onCheckedChange={wField.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">WhatsApp</FormLabel>
                            </FormItem>
                          )} />
                        </div>
                      <FormMessage /></FormItem>
                    )} />
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                    <Button type="submit" disabled={createClient.isPending}>
                      {createClient.isPending ? "Saving..." : "Save and Continue"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        )}

        {/* STEP 3: ORDER INFO */}
        {step === 3 && (
          <div className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Client Ready</AlertTitle>
              <AlertDescription className="text-blue-700">
                Proceeding with client: <strong>{foundClient?.name || clientForm.getValues().name}</strong>
              </AlertDescription>
            </Alert>

            <Form {...orderForm}>
              <form onSubmit={orderForm.handleSubmit(onOrderSubmit)} className="space-y-4">
                <FormField control={orderForm.control} name="packageId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package</FormLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                      {packages?.filter(p => p.isActive).map(pkg => (
                        <Card 
                          key={pkg.id} 
                          className={`cursor-pointer transition-all ${field.value === pkg.id ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:border-slate-300'}`}
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

                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={() => setStep(foundClient ? 1 : 2)}>Back</Button>
                  <Button type="submit">Preview Order</Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {/* STEP 4: REVIEW */}
        {step === 4 && selectedPkg && (
          <div className="space-y-6">
            <h3 className="font-semibold text-lg">Review and Submit</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-semibold flex items-center"><Building2 className="w-4 h-4 mr-2"/> Client Profile</h4>
                    <p className="text-sm"><strong>Name:</strong> {foundClient?.name || clientForm.getValues().name}</p>
                    <p className="text-sm"><strong>Tax Card:</strong> {foundClient?.taxCardNumber || clientForm.getValues().taxCardNumber}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-semibold flex items-center"><PackageIcon className="w-4 h-4 mr-2"/> Order Invoice</h4>
                    <p className="text-sm"><strong>Package:</strong> {selectedPkg.name}</p>
                    <div className="flex flex-col text-sm space-y-1">
                      <div className="flex justify-between"><span>Subtotal:</span><span>${Number(selectedPkg.price).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>VAT ({selectedPkg.vatPct}%):</span><span>${(Number(selectedPkg.price) * (Number(selectedPkg.vatPct)/100)).toFixed(2)}</span></div>
                      <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t"><span>Total:</span><span>${(Number(selectedPkg.price) * (1 + Number(selectedPkg.vatPct)/100)).toFixed(2)}</span></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={finishOrder} disabled={createOrder.isPending}>
                <Check className="mr-2 h-4 w-4" />
                {createOrder.isPending ? "Submitting..." : "Confirm & Submit Order"}
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
