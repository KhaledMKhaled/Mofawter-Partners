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

const queryClient = new QueryClient();

import ClientProfile from "@/pages/shared/client-profile";

function ProtectedRoute({ component: Component, role }: { component: React.ComponentType, role: string | string[] }) {
  const [location, setLocation] = useLocation();
  const token = localStorage.getItem("auth_token");

  if (!token) {
    return <Redirect to="/login" />;
  }

  const { data: user, isLoading, error } = useGetMe();

  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
  }

  if (error || !user) {
    localStorage.removeItem("auth_token");
    return <Redirect to="/login" />;
  }

  const hasRole = Array.isArray(role) ? role.includes(user.role) : user.role === role;

  if (!hasRole) {
    // Redirect to their respective dashboard
    const route = user.role === "ADMIN" ? "/admin" : user.role === "DISTRIBUTOR" ? "/distributor" : "/sales";
    return <Redirect to={route} />;
  }

  return (
    <Layout user={user}>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Admin Routes */}
      <Route path="/admin">{(params) => <ProtectedRoute component={AdminDashboard} role="ADMIN" />}</Route>
      <Route path="/admin/orders">{(params) => <ProtectedRoute component={AdminOrders} role="ADMIN" />}</Route>
      <Route path="/admin/users">{(params) => <ProtectedRoute component={AdminUsers} role="ADMIN" />}</Route>
      <Route path="/admin/clients">{(params) => <ProtectedRoute component={AdminClients} role="ADMIN" />}</Route>
      <Route path="/admin/commissions">{(params) => <ProtectedRoute component={AdminCommissions} role="ADMIN" />}</Route>
      <Route path="/admin/settings">{(params) => <ProtectedRoute component={AdminSettings} role="ADMIN" />}</Route>

      {/* Distributor Routes */}
      <Route path="/distributor">{(params) => <ProtectedRoute component={DistributorDashboard} role="DISTRIBUTOR" />}</Route>
      <Route path="/distributor/team">{(params) => <ProtectedRoute component={DistributorTeam} role="DISTRIBUTOR" />}</Route>
      <Route path="/distributor/clients">{(params) => <ProtectedRoute component={DistributorClients} role="DISTRIBUTOR" />}</Route>
      <Route path="/distributor/orders">{(params) => <ProtectedRoute component={DistributorOrders} role="DISTRIBUTOR" />}</Route>
      <Route path="/distributor/commissions">{(params) => <ProtectedRoute component={DistributorCommissions} role="DISTRIBUTOR" />}</Route>

      {/* Sales Routes */}
      <Route path="/sales">{(params) => <ProtectedRoute component={SalesDashboard} role="SALES" />}</Route>
      <Route path="/sales/clients">{(params) => <ProtectedRoute component={SalesClients} role="SALES" />}</Route>
      <Route path="/sales/orders">{(params) => <ProtectedRoute component={SalesOrders} role="SALES" />}</Route>
      <Route path="/sales/commissions">{(params) => <ProtectedRoute component={SalesCommissions} role="SALES" />}</Route>

      {/* Shared Protected Routes */}
      <Route path="/clients/:id">{(params) => <ProtectedRoute component={ClientProfile} role={["ADMIN", "DISTRIBUTOR", "SALES"]} />}</Route>

      <Route path="/">
        {() => {
          const token = localStorage.getItem("auth_token");
          if (!token) return <Redirect to="/login" />;
          return <Redirect to="/admin" />; // Let protected route handle specific redirect
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
