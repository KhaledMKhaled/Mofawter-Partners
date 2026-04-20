import { Link, useLocation } from "wouter";
import { User } from "@workspace/api-client-react";
import {
  LogOut, LayoutDashboard, ShoppingCart, Users, DollarSign,
  Settings, Users2, UserSquare2, Briefcase, FileBarChart2,
  ClipboardList, CreditCard, Shield, Sliders, Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

interface LayoutProps {
  children: React.ReactNode;
  user: User;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-500/15 text-red-400 border-red-500/20",
  OPERATIONS: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  DISTRIBUTOR: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  SALES: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

type NavItem = { title: string; url: string; icon: React.ComponentType<any>; group?: string };

export default function Layout({ children, user }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { t, locale, toggleLocale } = useI18n();

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    queryClient.clear();
    setLocation("/login");
  };

  const adminLinks: NavItem[] = [
    { title: t.nav.dashboard, url: "/admin", icon: LayoutDashboard, group: t.nav.operations },
    { title: t.nav.orders, url: "/admin/orders", icon: ShoppingCart, group: t.nav.operations },
    { title: t.nav.clients, url: "/admin/clients", icon: UserSquare2, group: t.nav.operations },
    { title: t.nav.commissions, url: "/admin/commissions", icon: DollarSign, group: t.nav.operations },
    { title: t.nav.paymentBatches, url: "/admin/payment-batches", icon: CreditCard, group: t.nav.operations },
    { title: t.nav.reports, url: "/admin/reports", icon: FileBarChart2, group: t.nav.reportsGroup },
    { title: t.nav.users, url: "/admin/users", icon: Users, group: t.nav.configuration },
    { title: t.nav.packages, url: "/admin/settings", icon: ClipboardList, group: t.nav.configuration },
    { title: t.nav.commissionRules, url: "/admin/commission-rules", icon: Sliders, group: t.nav.configuration },
    { title: t.nav.auditLog, url: "/admin/audit-log", icon: Shield, group: t.nav.configuration },
  ];

  const operationsLinks: NavItem[] = [
    { title: t.nav.dashboard, url: "/operations", icon: LayoutDashboard, group: t.nav.operations },
    { title: t.nav.orders, url: "/operations/orders", icon: ShoppingCart, group: t.nav.operations },
    { title: t.nav.clients, url: "/operations/clients", icon: UserSquare2, group: t.nav.operations },
    { title: t.nav.commissions, url: "/operations/commissions", icon: DollarSign, group: t.nav.operations },
    { title: t.nav.paymentBatches, url: "/operations/payment-batches", icon: CreditCard, group: t.nav.operations },
    { title: t.nav.reports, url: "/operations/reports", icon: FileBarChart2, group: t.nav.reportsGroup },
  ];

  const distributorLinks: NavItem[] = [
    { title: t.nav.dashboard, url: "/distributor", icon: LayoutDashboard, group: t.nav.overview },
    { title: t.nav.team, url: "/distributor/team", icon: Users2, group: t.nav.overview },
    { title: t.nav.clients, url: "/distributor/clients", icon: UserSquare2, group: t.nav.sales },
    { title: t.nav.orders, url: "/distributor/orders", icon: ShoppingCart, group: t.nav.sales },
    { title: t.nav.commissions, url: "/distributor/commissions", icon: DollarSign, group: t.nav.sales },
  ];

  const salesLinks: NavItem[] = [
    { title: t.nav.dashboard, url: "/sales", icon: LayoutDashboard, group: t.nav.overview },
    { title: t.nav.clients, url: "/sales/clients", icon: UserSquare2, group: t.nav.sales },
    { title: t.nav.orders, url: "/sales/orders", icon: ShoppingCart, group: t.nav.sales },
    { title: t.nav.commissions, url: "/sales/commissions", icon: DollarSign, group: t.nav.sales },
  ];

  const links =
    user.role === "ADMIN" ? adminLinks
    : user.role === "OPERATIONS" ? operationsLinks
    : user.role === "DISTRIBUTOR" ? distributorLinks
    : salesLinks;

  const grouped = links.reduce<Record<string, NavItem[]>>((acc, item) => {
    const g = item.group ?? t.nav.operations;
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  return (
    <SidebarProvider>
<<<<<<< HEAD
      <div className="flex min-h-screen w-full" dir={locale === "ar" ? "rtl" : "ltr"}>
        <Sidebar side={locale === "ar" ? "right" : "left"} className={locale === "ar" ? "border-l bg-sidebar" : "border-r bg-sidebar"}>
=======
      <div className="flex min-h-screen w-full">
        <Sidebar side={locale === "ar" ? "right" : "left"} className="bg-sidebar">
>>>>>>> df04e12050bfcb5b89722266a933864710a4cb20
          {/* Brand Header */}
          <SidebarHeader className="border-b border-sidebar-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/30">
                <Briefcase className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="brand-name">
                <span className="font-bold text-sidebar-foreground tracking-tight">Mofawter</span>
                <span className="font-bold text-primary tracking-tight"> Partners</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-3">
            {Object.entries(grouped).map(([group, items]) => (
              <SidebarGroup key={group}>
                <SidebarGroupLabel className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3 mb-1 mt-2">
                  {group}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((item) => {
                      const isActive = location === item.url ||
                        (item.url !== "/" && location.startsWith(item.url + "/"));
                      return (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.title}
                            className={`mx-1 rounded-lg transition-all duration-150 ${
                              isActive
                                ? "bg-primary/15 text-primary font-semibold shadow-sm"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            }`}
                          >
                            <Link href={item.url} className={`flex items-center gap-3 px-3 py-2.5 ${locale === "ar" ? "flex-row" : ""}`}>
                              <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                              <span className="text-sm font-medium">{item.title}</span>
                              {isActive && (
                                <div className="ms-auto h-1.5 w-1.5 rounded-full bg-primary" />
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          {/* User Footer */}
          <SidebarFooter className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 mb-3 px-1">
              <Avatar className="h-9 w-9 border-2 border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden min-w-0">
                <span className="truncate text-sm font-semibold text-sidebar-foreground leading-none mb-1">
                  {user.name}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit border ${ROLE_COLORS[user.role] ?? ""}`}>
                  {t.roles[user.role as keyof typeof t.roles] ?? user.role}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-start text-sidebar-foreground/60 border-sidebar-border hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={handleLogout}
              >
                <LogOut className="me-2 h-3.5 w-3.5" />
                {t.nav.signOut}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-sidebar-foreground/60 border-sidebar-border hover:text-sidebar-foreground hover:bg-sidebar-accent px-2"
                onClick={toggleLocale}
                title={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
              >
                <Languages className="h-3.5 w-3.5 me-1" />
                <span className="text-xs font-semibold">{locale === "ar" ? "EN" : "ع"}</span>
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 backdrop-blur px-3 py-2">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Briefcase className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold">Mofawter <span className="text-primary">Partners</span></span>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
