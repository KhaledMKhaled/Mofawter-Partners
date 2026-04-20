import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin, Role } from "@workspace/api-client-react"
import { ApiError } from "@workspace/api-client-react";
import { Briefcase, ArrowRight, Loader2, Languages } from "lucide-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, locale, toggleLocale } = useI18n();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loginMutation = useLogin();

  const loginSchema = z.object({
    email: z.string().email({ message: t.login.emailRequired }),
    password: z.string().min(1, { message: t.login.passwordRequired }),
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    setErrorMsg(null);
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          localStorage.setItem("auth_token", data.token);
          
          toast({
            title: t.login.welcomeBack,
            description: `${t.login.loggedInAs} ${data.user.name}`,
          });

          if (data.user.role === Role.ADMIN) setLocation("/admin");
          else if ((data.user.role as string) === "OPERATIONS") setLocation("/operations");
          else if (data.user.role === Role.DISTRIBUTOR) setLocation("/distributor");
          else setLocation("/sales");
        },
        onError: (error: ApiError<{ error?: string }>) => {
          const msg = error?.data?.error || t.login.invalidCredentials;
          setErrorMsg(msg);
        },
      }
    );
  }

  const fillTestCredentials = (email: string, password: string) => {
    form.setValue("email", email);
    form.setValue("password", password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Language Toggle */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLocale}
            className="gap-2"
          >
            <Languages className="h-4 w-4" />
            {locale === "ar" ? "English" : "العربية"}
          </Button>
        </div>

        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4 shadow-lg shadow-primary/20">
            <Briefcase className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight brand-name">{t.login.title}</h1>
          <p className="text-muted-foreground text-sm max-w-sm">
            {t.login.subtitle}
          </p>
        </div>

        <div className="bg-card border border-border shadow-sm rounded-xl p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {errorMsg && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.login.emailLabel}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t.login.emailPlaceholder}
                        {...field}
                        className="h-11"
                        autoComplete="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.login.passwordLabel}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t.login.passwordPlaceholder}
                        {...field}
                        className="h-11"
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium shadow-sm"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t.login.signingIn}
                  </>
                ) : (
                  <>
                    {t.login.signIn}
                    <ArrowRight className="ms-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-muted/30 px-2 text-muted-foreground font-medium">{t.login.testAccounts}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm">
            {[
              { label: t.roles.ADMIN, email: "admin@demo.test", password: "admin123" },
              { label: t.roles.DISTRIBUTOR, email: "distributor@demo.test", password: "distributor123" },
              { label: t.roles.SALES, email: "sales@demo.test", password: "sales123" },
            ].map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillTestCredentials(account.email, account.password)}
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="text-start">
                  <div className="font-medium text-foreground">{account.label}</div>
                  <div className="text-muted-foreground text-xs font-mono" dir="ltr">{account.email} / {account.password}</div>
                </div>
                <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{t.common.use}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
