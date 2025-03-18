import { useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';
    
    if (!isAuthenticated) {
      // Redirect to login page if not authenticated
      setLocation('/admin/login');
    }
  }, [setLocation]);
  
  // Check authentication status (client-side only to avoid hydration issues)
  if (typeof window !== 'undefined') {
    const isAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';
    
    if (!isAuthenticated) {
      // Return null while redirecting
      return null;
    }
  }
  
  return <>{children}</>;
}