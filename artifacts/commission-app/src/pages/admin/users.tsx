import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useListUsers, 
  useCreateUser,
  getListUsersQueryKey,
  Role,
  User
} from "@workspace/api-client-react"
import { ApiError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Users, Plus, Shield, Briefcase, UserSquare2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, formatDate } from "@/lib/format";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AdminUsers() {
  const { t, locale } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useListUsers(undefined, {
    query: { queryKey: getListUsersQueryKey() }
  });

  const createUser = useCreateUser();

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof userSchema>) {
    createUser.mutate(
      { 
        data: { 
          ...values, 
          role: Role.DISTRIBUTOR 
        } 
      },
      {
        onSuccess: () => {
          toast({ title: t.adminUsers.distributorCreated });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setIsDialogOpen(false);
          form.reset();
        },
        onError: (err: ApiError<{ error?: string }>) => {
          toast({
            title: t.adminUsers.errorCreating,
            description: err?.data?.error || "Unknown error",
            variant: "destructive"
          });
        }
      }
    );
  }

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case Role.ADMIN: return <Shield className="h-4 w-4 mr-1.5" />;
      case Role.DISTRIBUTOR: return <Briefcase className="h-4 w-4 mr-1.5" />;
      case Role.SALES: return <UserSquare2 className="h-4 w-4 mr-1.5" />;
    }
  };

  const getRoleColor = (role: Role) => {
    switch (role) {
      case Role.ADMIN: return "bg-purple-100 text-purple-800 border-purple-200";
      case Role.DISTRIBUTOR: return "bg-blue-100 text-blue-800 border-blue-200";
      case Role.SALES: return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t.adminUsers.title}</h2>
          <p className="text-muted-foreground mt-1">
            {t.adminUsers.subtitle}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="me-2 h-4 w-4" />
              {t.adminUsers.addDistributor}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.adminUsers.createDistributorTitle}</DialogTitle>
              <DialogDescription>
                {t.adminUsers.createDistributorDesc}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4 text-start">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.adminUsers.fullName}</FormLabel>
                      <FormControl>
                        <Input placeholder={t.adminUsers.fullNamePlaceholder} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.adminUsers.emailAddress}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t.adminUsers.emailPlaceholder} {...field} className={locale === "ar" ? "text-right" : ""} />
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
                      <FormLabel>{t.adminUsers.initialPassword}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={t.adminUsers.passwordPlaceholder} {...field} className={locale === "ar" ? "text-right" : ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" disabled={createUser.isPending}>
                    {createUser.isPending ? t.adminUsers.creating : t.adminUsers.createBtn}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.adminUsers.allUsers}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!users || users.length === 0 ? (
            <Empty 
              icon={Users}
              title={t.adminUsers.noUsers}
              description={t.adminUsers.noUsersDesc}
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.adminUsers.userTable}</TableHead>
                  <TableHead>{t.adminUsers.roleTable}</TableHead>
                  <TableHead>{t.adminUsers.emailTable}</TableHead>
                  <TableHead>{t.adminUsers.joinedTable}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-normal ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {t.roles[user.role as keyof typeof t.roles] ?? user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>{formatDate(user.createdAt, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
