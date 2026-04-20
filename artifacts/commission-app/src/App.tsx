import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useGetMe } from "@workspace/api-client-react";
import Login from "@/pages/login";
import Layout from "@/components/layout";

// Admin Pages
import AdminDashboard from "@/pages/admin/dashboard";
import AdminOrders from "@/pages/admin/orders";
import AdminUsers from "@/pages/admin/users";
import AdminClients from "@/pages/admin/clients";
import AdminCommissions from "@/pages/admin/commissions";
import AdminSettings from "@/pages/admin/settings";
import AdminPaymentBatches from "@/pages/admin/payment-batches";
import AdminCommissionRules from "@/pages/admin/commission-rules";
import AdminReports from "@/pages/admin/reports";
import AdminAuditLog from "@/pages/admin/audit-log";

// Distributor Pages
import DistributorDashboard from "@/pages/distributor/dashboard";
import DistributorTeam from "@/pages/distributor/team";
import DistributorClients from "@/pages/distributor/clients";
import DistributorOrders from "@/pages/distributor/orders";
import DistributorCommissions from "@/pages/distributor/commissions";

// Sales Pages
import SalesDashboard from "@/pages/sales/dashboard";
import SalesClients from "@/pages/sales/clients";
import SalesOrders from "@/pages/sales/orders";
import SalesCommissions from "@/pages/sales/commissions";

// Shared Pages
import ClientProfile from "@/pages/shared/client-profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

type AllowedRole = string | string[];

function ProtectedRoute({ component: Component, role }: { component: React.ComponentType; role: AllowedRole }) {
  const token = localStorage.getItem("auth_token");

  if (!token) {
    return <Redirect to="/login" />;
  }

  const { data: user, isLoading, error } = useGetMe();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">جارٍ التحميل…</span>
        </div>
      </div>
    );
  }

  if (error || !user) {
    localStorage.removeItem("auth_token");
    return <Redirect to="/login" />;
  }

  const hasRole = Array.isArray(role) ? role.includes(user.role) : user.role === role;

  if (!hasRole) {
    const route =
      user.role === "ADMIN" ? "/admin"
      : user.role === "OPERATIONS" ? "/operations"
      : user.role === "DISTRIBUTOR" ? "/distributor"
      : "/sales";
    return <Redirect to={route} />;
  }

  return (
    <Layout user={user}>
      <Component />
    </Layout>
  );
}

const ADMIN_ROLES = ["ADMIN"];
const ADMIN_OPS_ROLES = ["ADMIN", "OPERATIONS"];
const ALL_ROLES = ["ADMIN", "OPERATIONS", "DISTRIBUTOR", "SALES"];

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      {/* Admin Routes */}
      <Route path="/admin">{() => <ProtectedRoute component={AdminDashboard} role={ADMIN_ROLES} />}</Route>
      <Route path="/admin/orders">{() => <ProtectedRoute component={AdminOrders} role={ADMIN_OPS_ROLES} />}</Route>
      <Route path="/admin/users">{() => <ProtectedRoute component={AdminUsers} role={ADMIN_ROLES} />}</Route>
      <Route path="/admin/clients">{() => <ProtectedRoute component={AdminClients} role={ADMIN_OPS_ROLES} />}</Route>
      <Route path="/admin/commissions">{() => <ProtectedRoute component={AdminCommissions} role={ADMIN_OPS_ROLES} />}</Route>
      <Route path="/admin/settings">{() => <ProtectedRoute component={AdminSettings} role={ADMIN_ROLES} />}</Route>
      <Route path="/admin/payment-batches">{() => <ProtectedRoute component={AdminPaymentBatches} role={ADMIN_OPS_ROLES} />}</Route>
      <Route path="/admin/commission-rules">{() => <ProtectedRoute component={AdminCommissionRules} role={ADMIN_ROLES} />}</Route>
      <Route path="/admin/reports">{() => <ProtectedRoute component={AdminReports} role={ADMIN_OPS_ROLES} />}</Route>
      <Route path="/admin/audit-log">{() => <ProtectedRoute component={AdminAuditLog} role={ADMIN_ROLES} />}</Route>

      {/* Operations Routes — same pages as admin for operational sections */}
      <Route path="/operations">{() => <ProtectedRoute component={AdminDashboard} role={["OPERATIONS"]} />}</Route>
      <Route path="/operations/orders">{() => <ProtectedRoute component={AdminOrders} role={["OPERATIONS"]} />}</Route>
      <Route path="/operations/clients">{() => <ProtectedRoute component={AdminClients} role={["OPERATIONS"]} />}</Route>
      <Route path="/operations/commissions">{() => <ProtectedRoute component={AdminCommissions} role={["OPERATIONS"]} />}</Route>
      <Route path="/operations/payment-batches">{() => <ProtectedRoute component={AdminPaymentBatches} role={["OPERATIONS"]} />}</Route>
      <Route path="/operations/reports">{() => <ProtectedRoute component={AdminReports} role={["OPERATIONS"]} />}</Route>

      {/* Distributor Routes */}
      <Route path="/distributor">{() => <ProtectedRoute component={DistributorDashboard} role={["DISTRIBUTOR"]} />}</Route>
      <Route path="/distributor/team">{() => <ProtectedRoute component={DistributorTeam} role={["DISTRIBUTOR"]} />}</Route>
      <Route path="/distributor/clients">{() => <ProtectedRoute component={DistributorClients} role={["DISTRIBUTOR"]} />}</Route>
      <Route path="/distributor/orders">{() => <ProtectedRoute component={DistributorOrders} role={["DISTRIBUTOR"]} />}</Route>
      <Route path="/distributor/commissions">{() => <ProtectedRoute component={DistributorCommissions} role={["DISTRIBUTOR"]} />}</Route>

      {/* Sales Routes */}
      <Route path="/sales">{() => <ProtectedRoute component={SalesDashboard} role={["SALES"]} />}</Route>
      <Route path="/sales/clients">{() => <ProtectedRoute component={SalesClients} role={["SALES"]} />}</Route>
      <Route path="/sales/orders">{() => <ProtectedRoute component={SalesOrders} role={["SALES"]} />}</Route>
      <Route path="/sales/commissions">{() => <ProtectedRoute component={SalesCommissions} role={["SALES"]} />}</Route>

      {/* Shared Protected Routes */}
      <Route path="/clients/:id">{() => <ProtectedRoute component={ClientProfile} role={ALL_ROLES} />}</Route>

      {/* Root redirect */}
      <Route path="/">
        {() => {
          const token = localStorage.getItem("auth_token");
          if (!token) return <Redirect to="/login" />;
          return <Redirect to="/admin" />;
        }}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
