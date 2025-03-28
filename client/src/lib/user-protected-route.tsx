import { ReactNode } from "react";
import { Redirect, Route } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export function UserProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  console.log("UserProtectedRoute - Auth state:", { user, isLoading, path });

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    console.log("User not authenticated, redirecting to login");
    // Use window.location.href directly to avoid router issues
    return (
      <Route path={path}>
        {() => {
          // Use a small timeout to allow the render cycle to complete
          setTimeout(() => {
            window.location.href = "/login";
          }, 0);
          return null;
        }}
      </Route>
    );
  }

  // For the main page, any authenticated user can access it
  return <Route path={path} component={Component} />;
}