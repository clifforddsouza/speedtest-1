import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function UserLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { loginMutation, user } = useAuth();
  const isLoading = loginMutation.isPending;

  // Use useEffect to handle redirects when auth state changes
  useEffect(() => {
    // If user is already logged in, redirect to home
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast({
        title: "Validation Error",
        description: "Username and password are required",
        variant: "destructive",
      });
      return;
    }

    try {
      // Execute login
      await loginMutation.mutateAsync({ 
        username, 
        password 
      });

      // Redirect will happen automatically via the auth provider when user is set
    } catch (error) {
      // Error is handled in the mutation's onError
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">User Login</h1>
          <p className="text-gray-500 mt-2">Please log in to access the speed test</p>
        </div>
        
        <form onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text" 
                placeholder="Enter username"
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

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                Admin access? 
                <Button variant="link" className="p-0 ml-1" onClick={() => setLocation("/admin/login")}>
                  Login to Admin Dashboard
                </Button>
              </p>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}