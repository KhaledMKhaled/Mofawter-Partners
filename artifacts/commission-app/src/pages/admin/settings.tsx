import { useEffect, useRef } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useGetCommissionRates, 
  useUpdateCommissionRates,
  getGetCommissionRatesQueryKey 
} from "@workspace/api-client-react"
import { ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Percent } from "lucide-react";
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

const ratesSchema = z.object({
  salesPct: z.coerce.number().min(0).max(100, "Percentage cannot exceed 100"),
  distributorPct: z.coerce.number().min(0).max(100, "Percentage cannot exceed 100"),
});

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initRef = useRef<boolean>(false);

  const { data: rates, isLoading } = useGetCommissionRates({
    query: { queryKey: getGetCommissionRatesQueryKey() }
  });

  const updateRates = useUpdateCommissionRates();

  const form = useForm<z.infer<typeof ratesSchema>>({
    resolver: zodResolver(ratesSchema),
    defaultValues: {
      salesPct: 10,
      distributorPct: 5,
    },
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
    updateRates.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          toast({ title: "Commission rates updated successfully" });
          queryClient.setQueryData(getGetCommissionRatesQueryKey(), data);
        },
        onError: (err: ApiError<{ error?: string }>) => {
          toast({
            title: "Error updating rates",
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
        <Card className="max-w-2xl">
          <CardContent className="p-6 space-y-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure global platform rules and percentages.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Commission Rates
          </CardTitle>
          <CardDescription>
            These percentages apply to all new orders when they are marked as completed. Changing these values will not affect past commissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="salesPct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Agent Percentage</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            className="pr-8" 
                            {...field} 
                          />
                        </FormControl>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          %
                        </div>
                      </div>
                      <FormDescription>
                        Commission earned by the sales agent who submitted the order.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="distributorPct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distributor Percentage</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            className="pr-8" 
                            {...field} 
                          />
                        </FormControl>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          %
                        </div>
                      </div>
                      <FormDescription>
                        Commission earned by the distributor overseeing the sales agent.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={updateRates.isPending}>
                {updateRates.isPending ? "Saving..." : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
