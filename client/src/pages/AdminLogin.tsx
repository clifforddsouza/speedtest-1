import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/admin/session');
        if (response.status === 200) {
          // User is already authenticated and has admin privileges
          localStorage.setItem('isAdminAuthenticated', 'true');
          setLocation('/admin');
        } else {
          // User not authenticated or not admin
          localStorage.removeItem('isAdminAuthenticated');
        }
      } catch (error) {
        console.error("Error checking session:", error);
      }
    };
    
    checkSession();
  }, [setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Please enter both username and password",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // First attempt to login
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include' // Important for cookies
      });
      
      if (loginResponse.ok) {
        // Check if user has admin privileges
        const sessionResponse = await fetch('/api/admin/session', {
          credentials: 'include' // Important for cookies
        });
        
        if (sessionResponse.status === 200) {
          toast({
            title: "Success",
            description: "Logged in to your SpeedTest account successfully",
          });
          
          // Store authentication state in localStorage
          localStorage.setItem('isAdminAuthenticated', 'true');
          
          // Redirect to admin dashboard with the proper path format
          setLocation('/admin');
        } else {
          // User logged in but doesn't have admin privileges
          toast({
            title: "Access Denied",
            description: "Your account does not have the necessary privileges",
            variant: "destructive"
          });
          
          // Log the user out
          await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
          });
        }
      } else {
        // Login failed
        const data = await loginResponse.json();
        toast({
          title: "Login Failed",
          description: data.message || "Invalid username or password",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "An error occurred during login",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Login to your SpeedTest account</h1>
          <p className="text-gray-500 mt-2">Please enter your credentials</p>
        </div>
        
        <form onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text" 
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}