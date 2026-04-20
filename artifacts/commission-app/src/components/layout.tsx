import { Link, useLocation } from "wouter";
import { User, Role } from "@workspace/api-client-react";
import { LogOut, LayoutDashboard, ShoppingCart, Users, DollarSign, Settings, Users2, UserSquare2, Briefcase } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";

interface LayoutProps {
  children: React.ReactNode;
  user: User;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export default function Layout({ children, user }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    queryClient.clear();
    setLocation("/login");
  };

  const adminLinks = [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Orders", url: "/admin/orders", icon: ShoppingCart },
    { title: "Users", url: "/admin/users", icon: Users },
    { title: "Commissions", url: "/admin/commissions", icon: DollarSign },
    { title: "Settings", url: "/admin/settings", icon: Settings },
  ];

  const distributorLinks = [
    { title: "Dashboard", url: "/distributor", icon: LayoutDashboard },
    { title: "Team", url: "/distributor/team", icon: Users2 },
    { title: "Commissions", url: "/distributor/commissions", icon: DollarSign },
  ];

  const salesLinks = [
    { title: "Dashboard", url: "/sales", icon: LayoutDashboard },
    { title: "Clients", url: "/sales/clients", icon: UserSquare2 },
    { title: "Orders", url: "/sales/orders", icon: ShoppingCart },
    { title: "Commissions", url: "/sales/commissions", icon: DollarSign },
  ];

  const links =
    user.role === Role.ADMIN
      ? adminLinks
      : user.role === Role.DISTRIBUTOR
      ? distributorLinks
      : salesLinks;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <Sidebar className="border-r bg-card">
          <SidebarHeader className="border-b px-6 py-4 flex flex-row items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold leading-none tracking-tight">CommissionHQ</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 mt-4 mb-2">
                Menu
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {links.map((item) => {
                    const isActive = location === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className={`mx-2 rounded-md ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Link href={item.url} className="flex items-center gap-3 px-3 py-2">
                            <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t p-4">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-primary/5 text-primary text-xs font-medium">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium leading-none">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground mt-1">
                  {user.role}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
