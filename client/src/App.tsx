import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminLogin from "@/pages/AdminLogin";
import UserLogin from "@/pages/UserLogin";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminAccessDenied from "@/components/AdminAccessDenied";
import { AuthProvider } from "@/hooks/use-auth";
import { UserProtectedRoute } from "@/lib/user-protected-route";

function Router() {
  return (
    <Switch>
      {/* Protected main route - only authenticated users can access */}
      <UserProtectedRoute path="/" component={Home} />
      
      {/* Login routes */}
      <Route path="/login" component={UserLogin} />
      <Route path="/admin/login" component={AdminLogin} />
      
      {/* Redirect to login page as an additional entry point */}
      <Route path="/start">
        {() => <Redirect to="/login" />}
      </Route>
      
      {/* Admin dashboard with protected route */}
      <Route path="/admin">
        {(params) => (
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        )}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
