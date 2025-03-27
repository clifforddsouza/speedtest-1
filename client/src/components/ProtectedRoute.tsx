import { useEffect, ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  useEffect(() => {
    const verifyAdminSession = async () => {
      try {
        // First check localStorage for quick client-side check
        const isStoredAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';
        
        if (!isStoredAuthenticated) {
          console.log("No stored authentication, redirecting to login");
          setLocation('/admin/login');
          setIsLoading(false);
          return;
        }
        
        // Verify with the server
        const response = await fetch('/api/admin/session', {
          credentials: 'include'
        });
        
        if (response.status === 200) {
          // User is authenticated and has admin role
          console.log("Admin session verified");
          setIsAuthorized(true);
        } else {
          // Not authenticated or not admin, redirect to login
          console.log("Admin session verification failed", response.status);
          localStorage.removeItem('isAdminAuthenticated');
          setLocation('/admin/login');
        }
      } catch (error) {
        console.error("Admin session verification error:", error);
        localStorage.removeItem('isAdminAuthenticated');
        setLocation('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };
    
    verifyAdminSession();
  }, [setLocation]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAuthorized) {
    // Return null while redirecting
    return null;
  }
  
  return <>{children}</>;
}